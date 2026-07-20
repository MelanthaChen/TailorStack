import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { FileSystemObjectStorage } from "../packages/object-storage/src/index.js";

test("FileSystemObjectStorage supports object lifecycle", async () => {
  const rootPath = await mkdtemp(join(tmpdir(), "tailorstack-storage-"));
  const storage = new FileSystemObjectStorage({ rootPath, bucket: "bucket" });

  try {
    await storage.putObject("users/u1/resume.pdf", Buffer.from("hello"));
    assert.equal(await storage.exists("users/u1/resume.pdf"), true);
    assert.equal((await storage.getObject("users/u1/resume.pdf")).toString(), "hello");
    assert.equal((await storage.stat("users/u1/resume.pdf")).byteSize, 5);
    assert.match(await storage.createSignedUrl("users/u1/resume.pdf"), /^file:\/\//);
    await storage.deleteObject("users/u1/resume.pdf");
    assert.equal(await storage.exists("users/u1/resume.pdf"), false);
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
});
