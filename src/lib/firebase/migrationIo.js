import { firebaseMigrationClock, readLegacyRehabData, writeMigrationRun } from "./migrationRepository";
import { finalizeMigrationFailure, finalizeMigrationSuccess, readV2MigrationData, readV2MigrationSettings, writeV2MigrationData } from "./v2Repository";

export function createFirebaseMigrationIo(db) {
  return {
    now: firebaseMigrationClock,
    readLegacyData: (uid) => readLegacyRehabData(db, uid),
    writeV2Data: (uid, transformedData, options) =>
      writeV2MigrationData(db, uid, transformedData, { ...options, serverTimestamp: firebaseMigrationClock }),
    readMigrationSettings: (uid) => readV2MigrationSettings(db, uid),
    readV2Data: (uid, expectedData) => readV2MigrationData(db, uid, expectedData),
    finalizeSuccess: (uid, runId, data) => finalizeMigrationSuccess(db, uid, runId, data),
    finalizeFailure: (uid, runId, data) => finalizeMigrationFailure(db, uid, runId, data),
    writeMigrationRun: (uid, runId, data) => writeMigrationRun(db, uid, runId, data),
  };
}
