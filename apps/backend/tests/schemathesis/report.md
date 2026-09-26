/home/vikky/.local/lib/python3.10/site-packages/requests/__init__.py:113: RequestsDependencyWarning: urllib3 (2.6.3) or chardet (7.6.0)/charset_normalizer (3.4.4) doesn't match a supported version!
  warnings.warn(
Schemathesis v4.24.3
━━━━━━━━━━━━━━━━━━━━


 ✅  Loaded specification from openapi.yaml (in 0.19s)                          

     Base URL:         http://localhost:3000                                    
     Specification:    Open API 3.1.0                                           
     Operations:       9 selected / 20 total                                    


 ✅  API capabilities:                                                          

     Supports NULL byte in headers:                            ✘                
     Accepts backslash and control characters in URL paths:    ✓                

 ⏭   Examples (in 0.12s)                                                        
                                                                                
     ⏭  9 skipped                                                               

 ✅  Coverage (in 35.96s)                                                       
                                                                                
     ✅ 9 passed                                                                

 ✅  Fuzzing (in 304.46s)                                                       
                                                                                
     ✅ 9 passed                                                                

 ❌  Stateful (in 251.37s)                                                      

     Scenarios:    224                                                          
     API Links:    0 covered / 11 selected / 11 total (11 inferred)             

     ✅ 223 passed  ❌ 1 failed                                                 

=================================== FAILURES ===================================
________________________________ Stateful tests ________________________________
1. Test Case ID: GBYCts

- Server error

- Undocumented HTTP status code

    Received: 500
    Documented: 200, 400, 429

[500] Internal Server Error:

    `{"error":{"code":"INTERNAL_ERROR","message":"An unexpected error occurred","context":{}}}`

Reproduce with:

    curl -X GET 'http://localhost:3000/api/scenarios?offset=316&limit=197'
    
    st replay GBYCts

=================================== WARNINGS ===================================

Missing test data: 4 operations repeatedly returned 404 Not Found, preventing tests from reaching your API's core logic

  - DELETE /api/scenarios/{id}
  - GET /api/proof/{bundleHash}
  - GET /api/scenarios/{id}
  - PATCH /api/scenarios/{id}/status

💡 Provide realistic parameter values in your config file so tests can access existing resources

Schema validation mismatch: 5 operations mostly rejected generated data due to validation errors, indicating schema constraints don't match API validation

  - DELETE /api/scenarios/{id}
  - GET /api/scenarios/{id}
  - PATCH /api/scenarios/{id}/status
  - POST /api/proof/build
  - POST /api/scenarios

💡 Check your schema constraints - API validation may be stricter than documented

=================================== SUMMARY ====================================

API Operations:
  Selected: 9/20
  Tested: 9

Test Phases:
  ⏭  Examples
  ✅ Coverage
  ✅ Fuzzing
  ✅ Stateful

Failures:
  ❌ Server error: 1
  ❌ Undocumented HTTP status code: 1

Warnings:
  ⚠️ Missing valid test data: 4 operations repeatedly returned 404 responses
  ⚠️ Schema validation mismatch: 5 operations mostly rejected generated data

Test cases:
  2237 generated, 1 found 2 unique failures, 3 skipped

Reports:
  - JUNIT: tests/schemathesis/report.xml

Seed: 292565055957897866275051972612942845615

====================== 2 failures, 2 warnings in 591.98s =======================
