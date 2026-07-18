import { deterministicId } from "../lib/domain/ids.js";
import { createMigrationPreview, verifyWrittenMigration } from "./migrationReport.js";

const SOURCE_CHANGED_ERROR = "Legacy data changed after the migration preview. Run the preview again before migrating.";

function nowIso() {
  return new Date().toISOString();
}

function migrationRunId(uid, sourceFingerprint) {
  return deterministicId("legacy-migration-run", { uid, sourceFingerprint, schemaVersion: 2 });
}

function serializableError(error) {
  return error?.message || String(error);
}

function completedMigrationMetadataGuard(settings, sourceFingerprint) {
  const existingSourceFingerprint = settings?.sourceFingerprint || "";
  const existingLegacySourceFingerprint = settings?.legacySourceFingerprint || "";

  if (!existingSourceFingerprint || !existingLegacySourceFingerprint) {
    return {
      status: "blocked",
      existingSourceFingerprint,
      existingLegacySourceFingerprint,
      failureReason: "A completed migration exists but its fingerprint metadata is missing. The migration was blocked to avoid overwriting or mixing migrated generations.",
    };
  }

  if (existingSourceFingerprint !== existingLegacySourceFingerprint) {
    return {
      status: "blocked",
      existingSourceFingerprint,
      existingLegacySourceFingerprint,
      failureReason: "A completed migration exists but its stored source fingerprints are internally inconsistent. The migration was blocked to avoid overwriting or mixing migrated generations.",
    };
  }

  if (existingSourceFingerprint !== sourceFingerprint) {
    return {
      status: "blocked",
      existingSourceFingerprint,
      existingLegacySourceFingerprint,
      failureReason: "A completed migration already exists for a different legacy source fingerprint. The migration was blocked to avoid leaving stale migrated documents. Review the existing v2 data before replacing it.",
    };
  }

  return null;
}

function priorMigrationGuard(settings, sourceFingerprint) {
  if (!settings) return null;
  if (settings.migrationStatus === "completed") {
    return completedMigrationMetadataGuard(settings, sourceFingerprint);
  }
  if (settings.migrationStatus === "running") {
    return {
      status: "blocked",
      failureReason: "A migration is already marked as running. Resolve or mark the previous attempt failed before retrying.",
    };
  }
  return null;
}

export async function previewLegacyMigration({ uid, io }) {
  if (!uid) throw new Error("uid is required");
  if (!io?.readLegacyData) throw new Error("A migration IO adapter with readLegacyData is required");

  const legacyData = await io.readLegacyData(uid);
  return createMigrationPreview(legacyData, { userId: uid });
}

export async function executeLegacyMigration({ uid, expectedSourceFingerprint, confirm = false, io }) {
  if (!uid) throw new Error("uid is required");
  if (!io) throw new Error("A migration IO adapter is required");
  if (!confirm) {
    return {
      status: "blocked",
      canMigrate: false,
      errors: ["Migration confirmation is required."],
    };
  }

  const startedAt = io.now ? io.now() : nowIso();
  const preview = await previewLegacyMigration({ uid, io });
  const runId = migrationRunId(uid, preview.sourceFingerprint);

  if (preview.sourceFingerprint !== expectedSourceFingerprint) {
    const result = {
      status: "blocked",
      canMigrate: false,
      runId,
      sourceFingerprint: preview.sourceFingerprint,
      errors: [SOURCE_CHANGED_ERROR],
    };

    if (io.writeMigrationRun) {
      await io.writeMigrationRun(uid, runId, {
        schemaVersion: 2,
        source: "rehabData",
        sourcePath: `rehabData/${uid}`,
        sourceFingerprint: preview.sourceFingerprint,
        transformedFingerprint: preview.transformedFingerprint,
        status: "blocked",
        startedAt,
        completedAt: io.now ? io.now() : nowIso(),
        sourceCounts: preview.sourceCounts,
        transformedCounts: preview.transformedCounts,
        checks: preview.checks,
        warnings: preview.warnings,
        errors: result.errors,
        failureReason: SOURCE_CHANGED_ERROR,
      });
    }

    return result;
  }

  if (!preview.canMigrate) {
    if (io.writeMigrationRun) {
      await io.writeMigrationRun(uid, runId, {
        schemaVersion: 2,
        source: "rehabData",
        sourcePath: `rehabData/${uid}`,
        sourceFingerprint: preview.sourceFingerprint,
        transformedFingerprint: preview.transformedFingerprint,
        status: "failed",
        startedAt,
        completedAt: io.now ? io.now() : nowIso(),
        sourceCounts: preview.sourceCounts,
        transformedCounts: preview.transformedCounts,
        checks: preview.checks,
        warnings: preview.warnings,
        errors: preview.errors,
        failureReason: "Migration preview validation failed.",
      });
    }

    return {
      status: "failed",
      canMigrate: false,
      runId,
      sourceFingerprint: preview.sourceFingerprint,
      errors: preview.errors,
      warnings: preview.warnings,
    };
  }

  const existingSettings = io.readMigrationSettings ? await io.readMigrationSettings(uid) : null;
  const guard = priorMigrationGuard(existingSettings, preview.sourceFingerprint);
  if (guard) {
    const errors = [guard.failureReason];
    if (io.writeMigrationRun) {
      await io.writeMigrationRun(uid, runId, {
        schemaVersion: 2,
        source: "rehabData",
        sourcePath: `rehabData/${uid}`,
        sourceFingerprint: preview.sourceFingerprint,
        transformedFingerprint: preview.transformedFingerprint,
        status: "blocked",
        startedAt,
        completedAt: io.now ? io.now() : nowIso(),
        sourceCounts: preview.sourceCounts,
        transformedCounts: preview.transformedCounts,
        checks: preview.checks,
        warnings: preview.warnings,
        errors,
        failureReason: guard.failureReason,
        existingMigrationStatus: existingSettings?.migrationStatus || "unknown",
        existingSourceFingerprint: guard.existingSourceFingerprint || existingSettings?.sourceFingerprint || "",
        existingLegacySourceFingerprint: guard.existingLegacySourceFingerprint || existingSettings?.legacySourceFingerprint || "",
      });
    }
    return {
      status: "blocked",
      canMigrate: false,
      runId,
      sourceFingerprint: preview.sourceFingerprint,
      transformedFingerprint: preview.transformedFingerprint,
      errors,
      existingMigrationStatus: existingSettings?.migrationStatus || "unknown",
      existingSourceFingerprint: guard.existingSourceFingerprint || existingSettings?.sourceFingerprint || "",
      existingLegacySourceFingerprint: guard.existingLegacySourceFingerprint || existingSettings?.legacySourceFingerprint || "",
    };
  }

  await io.writeMigrationRun(uid, runId, {
    schemaVersion: 2,
    source: "rehabData",
    sourcePath: `rehabData/${uid}`,
    sourceFingerprint: preview.sourceFingerprint,
    transformedFingerprint: preview.transformedFingerprint,
    status: "running",
    startedAt,
    completedAt: null,
    sourceCounts: preview.sourceCounts,
    transformedCounts: preview.transformedCounts,
    checks: preview.checks,
    warnings: preview.warnings,
    errors: [],
  });

  try {
    let writtenCounts = null;
    try {
      writtenCounts = await io.writeV2Data(uid, preview.transformedData, {
        sourceFingerprint: preview.sourceFingerprint,
        transformedFingerprint: preview.transformedFingerprint,
        migrationRunId: runId,
      });
    } catch (error) {
      error.partialWrite = error.writeReport || null;
      throw error;
    }
    const writtenData = await io.readV2Data(uid, preview.transformedData);
    const verification = verifyWrittenMigration(preview, writtenData);

    if (!verification.passed) {
      if (io.finalizeFailure) {
        await io.finalizeFailure(uid, runId, {
          sourceFingerprint: preview.sourceFingerprint,
          transformedFingerprint: preview.transformedFingerprint,
          failedAt: io.now ? io.now() : nowIso(),
          failureReason: "Post-write verification failed.",
          errors: verification.errors,
          writtenCounts,
          verification,
        });
      } else {
        await io.writeMigrationRun(uid, runId, {
          status: "failed",
          completedAt: io.now ? io.now() : nowIso(),
          writtenCounts,
          verification,
          errors: verification.errors,
          failureReason: "Post-write verification failed.",
        });
      }

      return {
        status: "failed",
        canMigrate: false,
        runId,
        sourceFingerprint: preview.sourceFingerprint,
        writtenCounts,
        verification,
        errors: verification.errors,
      };
    }

    await io.finalizeSuccess(uid, runId, {
      sourceFingerprint: preview.sourceFingerprint,
      transformedFingerprint: preview.transformedFingerprint,
      migratedAt: io.now ? io.now() : nowIso(),
      writtenCounts,
      verification,
    });

    return {
      status: "completed",
      canMigrate: true,
      runId,
      sourceFingerprint: preview.sourceFingerprint,
      transformedFingerprint: preview.transformedFingerprint,
      sourceCounts: preview.sourceCounts,
      transformedCounts: preview.transformedCounts,
      checks: preview.checks,
      warnings: preview.warnings,
      writtenCounts,
      verification,
    };
  } catch (error) {
    const failureReason = serializableError(error);
    const partialWrite = error.partialWrite || error.writeReport || null;
    let statusRecordingError = null;
    try {
      if (io.finalizeFailure) {
        await io.finalizeFailure(uid, runId, {
          sourceFingerprint: preview.sourceFingerprint,
          transformedFingerprint: preview.transformedFingerprint,
          failedAt: io.now ? io.now() : nowIso(),
          failureReason,
          errors: [failureReason],
          partialWrite,
        });
      } else {
        await io.writeMigrationRun(uid, runId, {
          status: "failed",
          completedAt: io.now ? io.now() : nowIso(),
          errors: [failureReason],
          failureReason,
          partialWrite,
        });
      }
    } catch (recordError) {
      statusRecordingError = serializableError(recordError);
    }

    return {
      status: "failed",
      canMigrate: false,
      runId,
      sourceFingerprint: preview.sourceFingerprint,
      transformedFingerprint: preview.transformedFingerprint,
      errors: statusRecordingError ? [failureReason, `Failed to record migration failure: ${statusRecordingError}`] : [failureReason],
      failureReason,
      statusRecordingError,
      partialWrite,
    };
  }
}

export const __testables = { SOURCE_CHANGED_ERROR, migrationRunId, priorMigrationGuard, completedMigrationMetadataGuard };
