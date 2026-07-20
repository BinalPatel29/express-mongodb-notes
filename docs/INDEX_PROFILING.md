// Before
{
  explainVersion: '1',
  queryPlanner: {
    namespace: 'note_db.notes',
    parsedQuery: {
      userId: {
        '$eq': '6a5615c484e74e730bf4abd0'
      }
    },
    indexFilterSet: false,
    queryHash: 'E987E478',
    planCacheShapeHash: 'E987E478',
    planCacheKey: 'FA159199',
    optimizationTimeMillis: 0,
    maxIndexedOrSolutionsReached: false,
    maxIndexedAndSolutionsReached: false,
    maxScansToExplodeReached: false,
    prunedSimilarIndexes: false,
    winningPlan: {
      isCached: false,
      stage: 'SORT',
      sortPattern: {
        createdAt: -1
      },
      memLimit: 104857600,
      type: 'simple',
      inputStage: {
        stage: 'COLLSCAN',
        filter: {
          userId: {
            '$eq': '6a5615c484e74e730bf4abd0'
          }
        },
        nss: 'note_db.notes',
        direction: 'forward'
      }
    },
    rejectedPlans: []
  },
  executionStats: {
    executionSuccess: true,
    nReturned: 0,
    executionTimeMillis: 0,
    totalKeysExamined: 0,
    totalDocsExamined: 23,
    executionStages: {
      isCached: false,
      stage: 'SORT',
      nReturned: 0,
      executionTimeMillisEstimate: 0,
      works: 25,
      advanced: 0,
      needTime: 24,
      needYield: 0,
      saveState: 0,
      restoreState: 0,
      isEOF: 1,
      sortPattern: {
        createdAt: -1
      },
      memLimit: 104857600,
      type: 'simple',
      totalDataSizeSorted: 0,
      usedDisk: false,
      spills: 0,
      spilledRecords: 0,
      spilledBytes: 0,
      spilledDataStorageSize: 0,
      peakTrackedMemBytes: 0,
      inputStage: {
        stage: 'COLLSCAN',
        filter: {
          userId: {
            '$eq': '6a5615c484e74e730bf4abd0'
          }
        },
        nReturned: 0,
        executionTimeMillisEstimate: 0,
        works: 24,
        advanced: 0,
        needTime: 23,
        needYield: 0,
        saveState: 0,
        restoreState: 0,
        isEOF: 1,
        nss: 'note_db.notes',
        direction: 'forward',
        docsExamined: 23
      }
    }
  },
  queryShapeHash: 'E64C21C9B122C46404C72B876C7DBC4BAA5AB6A85448A3EFB634352591F48EB9',
  command: {
    find: 'notes',
    filter: {
      userId: '6a5615c484e74e730bf4abd0'
    },
    sort: {
      createdAt: -1
    },
    '$db': 'note_db'
  },
  serverInfo: {
    host: 'Mahadev',
    port: 27017,
    version: '8.3.4',
    gitVersion: '4b03e7daaa316c78b9bf433046dba81637d581c0'
  },
  serverParameters: {
    internalQueryFacetBufferSizeBytes: 104857600,
    internalDocumentSourceGroupMaxMemoryBytes: 104857600,
    internalQueryMaxBlockingSortMemoryUsageBytes: 104857600,
    internalDocumentSourceSetWindowFieldsMaxMemoryBytes: 104857600,
    internalQueryFacetMaxOutputDocSizeBytes: 104857600,
    internalLookupStageIntermediateDocumentMaxSizeBytes: 104857600,
    internalQueryProhibitBlockingMergeOnMongoS: 0,
    internalQueryMaxAddToSetBytes: 104857600,
    internalQueryFrameworkControl: 'trySbeRestricted',
    internalQueryPlannerIgnoreIndexWithCollationForRegex: 1
  },
  ok: 1
}


// After
{
  explainVersion: '1',
  queryPlanner: {
    namespace: 'note_db.notes',
    parsedQuery: {
      userId: {
        '$eq': '6a5615c484e74e730bf4abd0'
      }
    },
    indexFilterSet: false,
    queryHash: 'E987E478',
    planCacheShapeHash: 'E987E478',
    planCacheKey: '037646B4',
    optimizationTimeMillis: 13,
    maxIndexedOrSolutionsReached: false,
    maxIndexedAndSolutionsReached: false,
    maxScansToExplodeReached: false,
    prunedSimilarIndexes: false,
    winningPlan: {
      isCached: false,
      stage: 'FETCH',
      nss: 'note_db.notes',
      inputStage: {
        stage: 'IXSCAN',
        nss: 'note_db.notes',
        keyPattern: {
          userId: 1,
          createdAt: -1
        },
        indexName: 'userId_1_createdAt_-1',
        isMultiKey: false,
        multiKeyPaths: {
          userId: [],
          createdAt: []
        },
        isUnique: false,
        isSparse: false,
        isPartial: false,
        indexVersion: 2,
        direction: 'forward',
        indexBounds: {
          userId: [
            '["6a5615c484e74e730bf4abd0", "6a5615c484e74e730bf4abd0"]'
          ],
          createdAt: [
            '[MaxKey, MinKey]'
          ]
        }
      }
    },
    rejectedPlans: []
  },
  executionStats: {
    executionSuccess: true,
    nReturned: 0,
    executionTimeMillis: 17,
    totalKeysExamined: 0,
    totalDocsExamined: 0,
    executionStages: {
      isCached: false,
      stage: 'FETCH',
      nReturned: 0,
      executionTimeMillisEstimate: 0,
      works: 1,
      advanced: 0,
      needTime: 0,
      needYield: 0,
      saveState: 0,
      restoreState: 0,
      isEOF: 1,
      nss: 'note_db.notes',
      docsExamined: 0,
      alreadyHasObj: 0,
      inputStage: {
        stage: 'IXSCAN',
        nReturned: 0,
        executionTimeMillisEstimate: 0,
        works: 1,
        advanced: 0,
        needTime: 0,
        needYield: 0,
        saveState: 0,
        restoreState: 0,
        isEOF: 1,
        nss: 'note_db.notes',
        keyPattern: {
          userId: 1,
          createdAt: -1
        },
        indexName: 'userId_1_createdAt_-1',
        isMultiKey: false,
        multiKeyPaths: {
          userId: [],
          createdAt: []
        },
        isUnique: false,
        isSparse: false,
        isPartial: false,
        indexVersion: 2,
        direction: 'forward',
        indexBounds: {
          userId: [
            '["6a5615c484e74e730bf4abd0", "6a5615c484e74e730bf4abd0"]'
          ],
          createdAt: [
            '[MaxKey, MinKey]'
          ]
        },
        keysExamined: 0,
        seeks: 1,
        dupsTested: 0,
        dupsDropped: 0,
        peakTrackedMemBytes: 0
      }
    }
  },
  queryShapeHash: 'E64C21C9B122C46404C72B876C7DBC4BAA5AB6A85448A3EFB634352591F48EB9',
  command: {
    find: 'notes',
    filter: {
      userId: '6a5615c484e74e730bf4abd0'
    },
    sort: {
      createdAt: -1
    },
    '$db': 'note_db'
  },
  serverInfo: {
    host: 'Mahadev',
    port: 27017,
    version: '8.3.4',
    gitVersion: '4b03e7daaa316c78b9bf433046dba81637d581c0'
  },
  serverParameters: {
    internalQueryFacetBufferSizeBytes: 104857600,
    internalDocumentSourceGroupMaxMemoryBytes: 104857600,
    internalQueryMaxBlockingSortMemoryUsageBytes: 104857600,
    internalDocumentSourceSetWindowFieldsMaxMemoryBytes: 104857600,
    internalQueryFacetMaxOutputDocSizeBytes: 104857600,
    internalLookupStageIntermediateDocumentMaxSizeBytes: 104857600,
    internalQueryProhibitBlockingMergeOnMongoS: 0,
    internalQueryMaxAddToSetBytes: 104857600,
    internalQueryFrameworkControl: 'trySbeRestricted',
    internalQueryPlannerIgnoreIndexWithCollationForRegex: 1
  },
  ok: 1
}