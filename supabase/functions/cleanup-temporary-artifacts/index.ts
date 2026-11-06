import { createClient } from "@supabase/supabase-js";

const PAGE_SIZE = 500;
const DELETE_BATCH_SIZE = 100;
const STORAGE_BUCKETS = ["pengajuan-karya", "arsip", "avatars", "karya"];
const encoder = new TextEncoder();

type Submission = {
  id: string;
  attachment_path: string | null;
};

type InboxItem = {
  id: string;
};

type StorageEntry = {
  id: string | null;
  name: string;
  created_at?: string | null;
  updated_at?: string | null;
};

type WorkReferences = {
  document_path: string | null;
  cover_url: string | null;
  image_urls: unknown;
};

type CleanupCounts = {
  rejectedSubmissions: number;
  readNotifications: number;
  orphanFiles: Record<string, number>;
};

function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  if (leftBytes.length !== rightBytes.length) return false;

  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

function pathFromReference(bucket: string, value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const reference = value.trim();

  try {
    const url = new URL(reference);
    const parts = url.pathname.split("/").filter(Boolean);
    const objectIndex = parts.indexOf("object");
    if (objectIndex >= 0 && parts[objectIndex + 2] === bucket) {
      return parts
        .slice(objectIndex + 3)
        .map((part) => decodeURIComponent(part))
        .join("/");
    }
    return null;
  } catch {
    const prefix = `${bucket}/`;
    const path = reference.replace(/^\/+/, "");
    return path.startsWith(prefix) ? path.slice(prefix.length) : path;
  }
}

function addReference(
  references: Map<string, Set<string>>,
  bucket: string,
  value: unknown,
): void {
  const path = pathFromReference(bucket, value);
  if (path) references.get(bucket)?.add(path);
}

async function readAll<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

async function deleteRejectedSubmissions(
  ids: string[],
  cutoff: string,
): Promise<Set<string>> {
  const deletedIds = new Set<string>();
  for (let index = 0; index < ids.length; index += DELETE_BATCH_SIZE) {
    const { data, error } = await admin
      .from("work_submissions")
      .delete()
      .in("id", ids.slice(index, index + DELETE_BATCH_SIZE))
      .eq("status", "rejected")
      .lt("reviewed_at", cutoff)
      .select("id");
    if (error) {
      throw new Error(`Gagal membersihkan work_submissions: ${error.message}`);
    }
    for (const row of data || []) deletedIds.add(row.id);
  }
  return deletedIds;
}

async function deleteReadNotifications(
  ids: string[],
  cutoff: string,
): Promise<number> {
  let deletedCount = 0;
  for (let index = 0; index < ids.length; index += DELETE_BATCH_SIZE) {
    const { data, error } = await admin
      .from("account_inbox")
      .delete()
      .in("id", ids.slice(index, index + DELETE_BATCH_SIZE))
      .eq("is_read", true)
      .lt("created_at", cutoff)
      .select("id");
    if (error) {
      throw new Error(`Gagal membersihkan account_inbox: ${error.message}`);
    }
    deletedCount += data?.length || 0;
  }
  return deletedCount;
}

async function listBucketFiles(
  bucket: string,
): Promise<Array<{ name: string; createdAt: string | null }>> {
  const files: Array<{ name: string; createdAt: string | null }> = [];
  const folders = [""];

  while (folders.length) {
    const prefix = folders.pop()!;
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await admin.storage.from(bucket).list(prefix, {
        limit: PAGE_SIZE,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) {
        throw new Error(`Gagal membaca bucket ${bucket}: ${error.message}`);
      }

      const entries = (data || []) as StorageEntry[];
      for (const entry of entries) {
        const name = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.id === null) {
          folders.push(name);
        } else {
          files.push({
            name,
            createdAt: entry.created_at || entry.updated_at || null,
          });
        }
      }
      if (entries.length < PAGE_SIZE) break;
    }
  }
  return files;
}

async function removeStorageFiles(
  bucket: string,
  paths: string[],
): Promise<void> {
  for (let index = 0; index < paths.length; index += DELETE_BATCH_SIZE) {
    const { error } = await admin.storage
      .from(bucket)
      .remove(paths.slice(index, index + DELETE_BATCH_SIZE));
    if (error)
      throw new Error(`Gagal menghapus berkas ${bucket}: ${error.message}`);
  }
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

const admin = createClient(
  requiredEnv("SUPABASE_URL"),
  requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { autoRefreshToken: false, persistSession: false } },
);
const cleanupSecret = requiredEnv("CLEANUP_CRON_SECRET");

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed." }, { status: 405 });
  }

  const authorization = request.headers.get("authorization") || "";
  if (!constantTimeEqual(authorization, `Bearer ${cleanupSecret}`)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const errors: string[] = [];
  const counts: CleanupCounts = {
    rejectedSubmissions: 0,
    readNotifications: 0,
    orphanFiles: Object.fromEntries(
      STORAGE_BUCKETS.map((bucket) => [bucket, 0]),
    ),
  };

  try {
    const [rejectedSubmissions, readNotifications] = await Promise.all([
      readAll<Submission>((from, to) =>
        admin
          .from("work_submissions")
          .select("id, attachment_path")
          .eq("status", "rejected")
          .lt("reviewed_at", cutoff)
          .order("id")
          .range(from, to),
      ),
      readAll<InboxItem>((from, to) =>
        admin
          .from("account_inbox")
          .select("id")
          .eq("is_read", true)
          .lt("created_at", cutoff)
          .order("id")
          .range(from, to),
      ),
    ]);

    const references = new Map<string, Set<string>>(
      STORAGE_BUCKETS.map((bucket) => [bucket, new Set<string>()] as const),
    );
    const [archiveFiles, submissions, works, profiles] = await Promise.all([
      readAll<{ storage_path: string | null }>((from, to) =>
        admin
          .from("archive_files")
          .select("storage_path")
          .order("id")
          .range(from, to),
      ),
      readAll<Submission>((from, to) =>
        admin
          .from("work_submissions")
          .select("id, attachment_path")
          .order("id")
          .range(from, to),
      ),
      readAll<WorkReferences>((from, to) =>
        admin
          .from("works")
          .select("document_path, cover_url, image_urls")
          .order("id")
          .range(from, to),
      ),
      readAll<{ avatar_url: string | null }>((from, to) =>
        admin
          .from("user_profiles")
          .select("avatar_url")
          .order("user_id")
          .range(from, to),
      ),
    ]);

    for (const file of archiveFiles) {
      addReference(references, "arsip", file.storage_path);
    }
    const expiredSubmissionIds = new Set(
      rejectedSubmissions.map(({ id }) => id),
    );
    for (const submission of submissions) {
      if (expiredSubmissionIds.has(submission.id)) continue;
      addReference(references, "pengajuan-karya", submission.attachment_path);
    }
    for (const work of works) {
      addReference(references, "pengajuan-karya", work.document_path);
      addReference(references, "karya", work.cover_url);
      let images = work.image_urls;
      if (typeof images === "string") {
        try {
          images = JSON.parse(images);
        } catch {
          images = [];
        }
      }
      if (Array.isArray(images)) {
        for (const image of images) addReference(references, "karya", image);
      }
    }
    for (const profile of profiles) {
      addReference(references, "avatars", profile.avatar_url);
    }

    const deletedSubmissionIds = await deleteRejectedSubmissions(
      rejectedSubmissions.map(({ id }) => id),
      cutoff,
    );
    counts.rejectedSubmissions = deletedSubmissionIds.size;

    const rejectedAttachments = rejectedSubmissions
      .filter(({ id }) => deletedSubmissionIds.has(id))
      .map(({ attachment_path }) => attachment_path)
      .filter(
        (path): path is string =>
          typeof path === "string" &&
          !references.get("pengajuan-karya")?.has(path),
      );
    if (rejectedAttachments.length) {
      try {
        await removeStorageFiles("pengajuan-karya", rejectedAttachments);
      } catch (error) {
        errors.push(String(error));
      }
    }

    counts.readNotifications = await deleteReadNotifications(
      readNotifications.map(({ id }) => id),
      cutoff,
    );

    for (const bucket of STORAGE_BUCKETS) {
      const files = await listBucketFiles(bucket);
      const unreferenced = files
        .filter((file) => {
          if (
            !file.createdAt ||
            new Date(file.createdAt).getTime() >= Date.parse(cutoff)
          ) {
            return false;
          }
          return !references.get(bucket)?.has(file.name);
        })
        .map(({ name }) => name);

      if (unreferenced.length) {
        try {
          await removeStorageFiles(bucket, unreferenced);
          counts.orphanFiles[bucket] = unreferenced.length;
        } catch (error) {
          errors.push(String(error));
        }
      }
    }

    if (errors.length) {
      console.error(
        "Temporary artifact cleanup completed with errors:",
        errors,
      );
      return Response.json({ counts, errors }, { status: 500 });
    }
    return Response.json({ counts, cutoff });
  } catch (error) {
    console.error("Temporary artifact cleanup failed:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Cleanup failed." },
      { status: 500 },
    );
  }
});
