function replaceRequired(code, oldText, newText, id) {
  if (!code.includes(oldText)) throw new Error(`One-time equipment migration transform could not find expected source in ${id}`);
  return code.replace(oldText, newText);
}

export function oneTimeEquipmentMigrationBuildPlugin() {
  return {
    name: "one-time-equipment-migration",
    enforce: "pre",
    transform(code, id) {
      const cleanId = id.split("?")[0].replaceAll("\\\\", "/");
      if (!cleanId.endsWith("/src/App.jsx")) return null;

      let next = replaceRequired(
        code,
        'import ProgressScreen from "./features/progress/ProgressScreen";',
        'import ProgressScreen from "./features/progress/ProgressScreen";\nimport EquipmentHistoryMigration from "./features/migrations/EquipmentHistoryMigration";',
        id,
      );

      next = replaceRequired(
        next,
        '<Button variant="outline" onClick={handleLogout}>Log out</Button>',
        '<EquipmentHistoryMigration user={user}/><Button variant="outline" onClick={handleLogout}>Log out</Button>',
        id,
      );

      return next;
    },
  };
}
