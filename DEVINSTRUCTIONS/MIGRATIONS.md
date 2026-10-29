# migrations

When modifying the saved data, you must implement migrations for older data so users never
end up in an invalid state. We use TypeScript's type system to model this requirement and
help ensure they are met.

> [!IMPORTANT]
> Never modify the old migrations. Once they are committed, they must never be changed
> to ensure user data is always valid. If you must fix something, add another migration.

## what data goes in what

- metadata: data about the project, such as the name, last updated time, etc.
- iridium: random dump of anything we want to save
- results: just the simulation history (we keep it separate since it can get pretty big)

- graphSettings: data about graph settings. Every `iridium` should contain some version of this.
  These are also independently stored per preset.

## how to modify change saved data

> [!TIP]
> When implementing a migration, prefer not to test manually as you might mess up your data.
> Instead, add a test in `src/features/migration/__tests__/migrations.ts` and run `npm run test src/features/migrations`
> then once everything is passing, test manually.

### 1. defining the migration

1.  In `src/features/migrations/`, find which data you want to modify, then add a file into it
    with the name: `v{version}_{description}.ts` (e.g. `v3_stochasticSimulations`).
2.  In the file, add the type: `{data}V{version tag}` (e.g. `IridiumDataV3`)
3.  The type should contain the new version of the saved data. Make sure to add a property called
    `versionTag` to the type. This will allow us to know which version of the data we have at runtime.
    If you are just adding new properties to the saved data, it might be useful to import an older
    migration's type then intersect it with the new properties (e.g. `type DataV3 = DataV2 & { color: string }`.
    You can look in `migrations/iridium/v2_simulationParameters.ts` for an example of what you want
    to end up with.
4.  Add a function `migrate{data}{previous version}{new version}` (e.g. `migrateMetadataV1V2`). This
    function should take in data of the previous version and return data of the next version. You are free
    to implement this however you like.

### 2. updating the types

1.  In `features/savedData.ts`, import the type and migration function. Find the appropriate
    `Unknown[data]` (e.g `UnknownIridiumData`) and add the type you just made to the union.
2.  Update the `[data]` (e.g. `IridiumData`) type to the latest version of the data.
3.  At this point, you should be getting a few type errors. We will need to fix all of these,
    and once we do, we can be pretty confident the migration will work.

### 3. integrating the migration

1.  Find the appropriate migration function in `features/savedData.ts`. You will see a switch
    statement on the `versionTag`.
2.  Find the case for the previous data's version tag, and replace it with something like
    this: `return migrateIridiumData(migrateIridiumDataV1V2(iridiumData))`
3.  Add another case for the _current_ data's versionTag (the one you just made).
4.  In the case, do something like this: `return iridiumData` (since there is nothing to migrate, it is the latest)
5.  At the bottom of the file, fix the `getNewProjectData` so it matches the changes you made to the data type.
6.  In `src/globals/saving`, fix the appropriate atom so it returns data of the latest version.
7.  Run `npm run typecheck` to check if there's anything else to fix.

### 4. ensure loads, tests

1. In `src/globals/projectData`, make sure the changes you made are being loaded properly!
2. Add a test in `src/features/migrations/__tests__/migrations.ts`. In most cases, this should just be
   the moving the `finalVerion` variable into `olderVersions` then replacing it with your new data.
3. Test manually
4. Congrats! You have implemented a data migration.
