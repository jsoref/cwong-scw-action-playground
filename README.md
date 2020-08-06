# Public Code Scanning REST API

This document describes the public code scanning REST API, and does not address endpoints that are only accessible via GH Actions, or webhooks. 

1. `/sarifs`
2. `/analyses`
3. `/alerts`

## Upload a SARIF file `/sarifs`

`POST /repositories/:repository_id/code-scanning/sarifs`

```json
    "schema": {
        "properties": {
          "commit_sha": {
            "$ref": "#/definitions/commit_oid"
          },
          "ref": {
            "$ref": "#/definitions/ref"
          },
          "sarif": {
            "$ref": "#/definitions/sarif"
          },
          "checkout_uri": {
            "$ref": "#/definitions/checkout_uri"
          },
          "started_at": {
            "$ref": "#/definitions/started_at"
          },
          "tool_name": {
            "$ref": "#/definitions/tool_name"
          }
        },
        "required": [
          "commit_sha",
          "ref",
          "sarif",
          "tool_names"
        ],
        "type": "object",
        "additionalProperties": false
    }
```

where
- `ref` and `commit_sha` must be valid for the target repo
- `sarif` is a base64 string representing a SARIF file. The content must be gzip compressed.
- `tool_name` only used to generate the CheckRun, and might not coincide with the SARIF content

Returns a `202` status if successful with an empty response.


(Not Implemented) Return a receipt (see next endpoint)

## (Not Implemented) Check upload status `/sarif/:receipt`

`GET /repositories/:repository_id/code-scanning/sarifs/:recepit`

returns `200` with:

```json
{
    "status": "pending"
}
```

```json
{
    "status": "done",
    "stats":
    {
        "runs": 2,
        "tools": 1,
        "results": 137,
        "errors": 1
    },

    "analyses": [
        {
            "id": 126,
            "error": "Invalid entry in line 77"
        },
        ...
    ],
}
```

## Return the most recent analyses `/analyses`

`GET /repositories/:repository_id/code-scanning/analyses`

Optional filters (query parameters):
* `ref`: A comma separated list of refs to consider.
  * Example: `refs/heads/master`, `refs/pull/1/head`
  * Default: All refs
* `tool_name`: A single tool name to filter on:
  * Example: `CodeQL command-line tool`
  * Default: All tools
* (Not Implemented) `commit_sha`: A commit to filter on.
  * Was suggested recently as being maybe the other main dimension we would want to filter on.

Returns a list of `Analysis Summary`:

```json
"properties": {
    "commit_sha": {
      "type": "string",
      "example": "f921edcc74d6b492ec068f5aa02b0e9a2cd45f5b"
    },
    "ref": {
      "type": "string",
      "example": "refs/heads/master"
    },
    "analysis_key": {
      "type": "string"
    },
    "created_at": {
      "type": "string",
      "format": "date-time"
    },
    "tool_name": {
      "type": "string",
      "example": "CodeQL command-line toolchain"
    },
    "error": {
      "type": "string",
      "example": "error reading field xyz"
    },
    "matrix_vars": {
      "type": "string"
    }
  },
```

where:
* Most fields match the `/sarifs` input
* API users cannot define `analysis_key` and `matrix_vars`. However, we do have them from Actions, so we need to expose them to avoid confusion.

Note: A SARIF file with N runs yields up to N analyses.

## View all alerts `/alerts`

`GET /repositories/:repository_id/code-scanning/alerts`

Optional filters (query parameters):
* `ref`: Only return alerts that apply to this ref
  * Default: return alerts that apply to the default branch
* `state`: `open`, `closed`, `dismissed` returns all alerts in the given state.
  *  Default: return alerts in any state

Returns:

``` json
  "properties": {
    "number": {
      "$ref": "#/definitions/number"
    },
    "rule_id": {
      "$ref": "#/definitions/rule_id"
    },
    "rule_severity": {
      "$ref": "#/definitions/rule_severity"
    },
    "rule_description": {
      "$ref": "#/definitions/rule_description"
    },
    "tool": {
      "oneOf": [
        {
          "type": "null"
        },
        {
          "$ref": "#/definitions/tool"
        }
      ]
    },
    "open": {
      "$ref": "#/definitions/open"
    },
    "url": {
      "$ref": "#/definitions/url"
    },
    "html_url": {
      "$ref": "#/definitions/html_url"
    },
    "created_at": {
      "$ref": "#/definitions/created_at"
    },
    "dismissed_at": {
      "oneOf": [
        {
          "type": "null"
        },
        {
          "$ref": "#/definitions/dismissed_at"
        }
      ]
    },
    "dismissed_by": {
      "oneOf": [
        {
          "type": "null"
        },
        {
          "$ref": "https://schema.github.com/v3/simple-user.json#"
        }
      ]
    },
    "dismissed_reason": {
      "oneOf": [
        {
          "type": "null"
        },
        {
          "$ref": "#/definitions/dismissed_reason"
        }
      ]
    }
  },
```

Where:

**Decision**
- `tool` becomes an object with properties to eventually allow us to capture more of the SARIF specification. At minimum:
  ```
    "name": "CodeQL command-line tool",
    "display_name": "CodeQL",
    "version": "1.2.3"
  ```
- `open` is deprecated for a `state` enumerative that can be `open`, `fixed`, or `dismissed`. With `dimissed_reason` being one of:
  - `won't fix`, `used in tests`, `false positive`
  - In the future, we might have `suppressed` as additional state.
- (Optional) `rule` also becomes an object, this will probably help with dealing with rule versioning and rule help in the future.


**Note**: As we do not expose `analysis_key` and `matrix_vars` in this view, and only provide a single state per alert, the state is the one reflected by any possible value of `analysis_key` and `matrix_vars`. Meaning that an alert might be open because once we ran the analysis with a setup that lead to a different `analysis_key`, but since fixing the issue we did not re-run this configuration.

## View a single alert `/alerts/:number`

`GET /repositories/:repository_id/code-scanning/alerts/:alert_number`

No filtering is allowed. The return object is similar to the one returned by `alerts`, thus the same considerations apply.

In addition, each alert includes an `instances` property that is meant to provide the link between logical and physical alerts.

- Add an `instances` matrix to detail the state of the alert in various refs, analysis_key (matrix_vars) combinations:
  ```json
   "instances": [
       {
           "ref": "refs/heads/main",
           "analysis_key": "(default)",
           "matrix_vars" : "{}",
           "state": "open"

       },
       {
           "ref": "refs/heads/branch1",
           "analysis_key": "(default)",
           "matrix_vars" : "{}",
           "state": "closed",
           "closed_reason": "fixed"
        }
   ]
  ```

The `instances` matrix might in the future include information from the physical alert like `location`.


## Change single alert state `/alerts/:number`

`PATCH /repositories/:repository_id/code-scanning/alerts/:alert_number`

With content:

```json
      "schema": {
        "properties": {
          "state": {
            "open" or "dismissed"
          }
          "dismissed_reason": {
            "$ref": "#/definitions/dismissed_reason"
          }
        },
        "required": [
          "state  "
        ],
        "type": "object",
        "additionalProperties": false
      }
```

where
- Valid `state` changes are:
  - From `open` to `dismissed` (and `dismissed_reason` must be non-empty)
  - From `dismissed` to `open`
- `dismissed_reason` can only be one of: `won't fix`, `used in tests`, `false positive`.

NOTE: The change of state impacts the alert independently of the `ref`, `analysis_key`, `matrix_vars`.
