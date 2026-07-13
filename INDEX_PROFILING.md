PS C:\projects\mongo> node profile.js
{
  "explainVersion": "1",
  "queryPlanner": {
    "namespace": "note_db.notes",
    "parsedQuery": {
      "userId": {
        "$eq": "6a49ff3a7eeff7e8cd8e88d3"
      }
    },
    "indexFilterSet": false,
    "queryHash": "E987E478",
    "planCacheShapeHash": "E987E478",
    "planCacheKey": "037646B4",
    "optimizationTimeMillis": 1,
    "maxIndexedOrSolutionsReached": false,
    "maxIndexedAndSolutionsReached": false,
    "maxScansToExplodeReached": false,
    "prunedSimilarIndexes": false,
    "winningPlan": {
      "isCached": false,
      "stage": "FETCH",
      "nss": "note_db.notes",
      "inputStage": {
        "stage": "IXSCAN",
        "nss": "note_db.notes",
        "keyPattern": {
          "userId": 1,
          "createdAt": -1
        },
        "indexName": "userId_1_createdAt_-1",
        "isMultiKey": false,
        "multiKeyPaths": {
          "userId": [],
          "createdAt": []
        },
        "isUnique": false,
        "isSparse": false,
        "isPartial": false,
        "indexVersion": 2,
        "direction": "forward",
        "indexBounds": {
          "userId": [
            "[ObjectId('6a49ff3a7eeff7e8cd8e88d3'), ObjectId('6a49ff3a7eeff7e8cd8e88d3')]"
          ],
          "createdAt": [
            "[MaxKey, MinKey]"
          ]
        }
      }
    },
    "rejectedPlans": []
  },
  "executionStats": {
    "executionSuccess": true,
    "nReturned": 5,
    "executionTimeMillis": 1,
    "totalKeysExamined": 5,
    "totalDocsExamined": 5,
    "executionStages": {
      "isCached": false,
      "stage": "FETCH",
      "nReturned": 5,
      "executionTimeMillisEstimate": 0,
      "works": 6,
      "advanced": 5,
      "needTime": 0,
      "needYield": 0,
      "saveState": 0,
      "restoreState": 0,
      "isEOF": 1,
      "nss": "note_db.notes",
      "docsExamined": 5,
      "alreadyHasObj": 0,
      "inputStage": {
        "stage": "IXSCAN",
        "nReturned": 5,
        "executionTimeMillisEstimate": 0,
        "works": 6,
        "advanced": 5,
        "needTime": 0,
        "needYield": 0,
        "saveState": 0,
        "restoreState": 0,
        "isEOF": 1,
        "nss": "note_db.notes",
        "keyPattern": {
          "userId": 1,
          "createdAt": -1
        },
        "indexName": "userId_1_createdAt_-1",
        "isMultiKey": false,
        "multiKeyPaths": {
          "userId": [],
          "createdAt": []
        },
        "isUnique": false,
        "isSparse": false,
        "isPartial": false,
        "indexVersion": 2,
        "direction": "forward",
        "indexBounds": {
          "userId": [
            "[ObjectId('6a49ff3a7eeff7e8cd8e88d3'), ObjectId('6a49ff3a7eeff7e8cd8e88d3')]"
          ],
          "createdAt": [
            "[MaxKey, MinKey]"
          ]
        },
        "keysExamined": 5,
        "seeks": 1,
        "dupsTested": 0,
        "dupsDropped": 0,
        "peakTrackedMemBytes": 0
      }
    }
  },
  "queryShapeHash": "46ECBBD450DF312278AC6651403DDD3A07D33313C858570513DA1F4343D9631E",
  "command": {
    "find": "notes",
    "filter": {
      "userId": "6a49ff3a7eeff7e8cd8e88d3"
    },
    "sort": {
      "createdAt": -1
    },
    "$db": "note_db"
  },
  "serverInfo": {
    "host": "Mahadev",
    "port": 27017,
    "version": "8.3.4",
    "gitVersion": "4b03e7daaa316c78b9bf433046dba81637d581c0"
  },
  "serverParameters": {
    "internalQueryFacetBufferSizeBytes": 104857600,
    "internalDocumentSourceGroupMaxMemoryBytes": 104857600,
    "internalQueryMaxBlockingSortMemoryUsageBytes": 104857600,
    "internalDocumentSourceSetWindowFieldsMaxMemoryBytes": 104857600,
    "internalQueryFacetMaxOutputDocSizeBytes": 104857600,
    "internalLookupStageIntermediateDocumentMaxSizeBytes": 104857600,
    "internalQueryProhibitBlockingMergeOnMongoS": 0,
    "internalQueryMaxAddToSetBytes": 104857600,
    "internalQueryFrameworkControl": "trySbeRestricted",
    "internalQueryPlannerIgnoreIndexWithCollationForRegex": 1
  },
  "ok": 1
}