/home/vikky/.local/lib/python3.10/site-packages/requests/__init__.py:113: RequestsDependencyWarning: urllib3 (2.6.3) or chardet (7.6.0)/charset_normalizer (3.4.4) doesn't match a supported version!
  warnings.warn(
Schemathesis v4.24.3
━━━━━━━━━━━━━━━━━━━━


 ✅  Loaded specification from openapi.yaml (in 0.21s)                          

     Base URL:         http://localhost:3000                                    
     Specification:    Open API 3.1.0                                           
     Operations:       18 selected / 29 total                                   


 ✅  API capabilities:                                                          

     Supports NULL byte in headers:                            ✘                
     Accepts backslash and control characters in URL paths:    ✓                

 ⏭   Examples (in 0.14s)                                                        
                                                                                
     ⏭  18 skipped                                                              

 ✅  Coverage (in 43.24s)                                                       
                                                                                
     ✅ 18 passed                                                               

 ✅  Fuzzing (in 512.89s)                                                       
                                                                                
     ✅ 18 passed                                                               

 ✅  Stateful (in 132.10s)                                                      

     Scenarios:    150                                                          
     API Links:    0 covered / 11 selected / 11 total (11 inferred)             

     ✅ 150 passed                                                              

=================================== WARNINGS ===================================

Missing test data: 5 operations repeatedly returned 404 Not Found, preventing tests from reaching your API's core logic

  - DELETE /api/scenarios/{id}
  - GET /api/proof/{bundleHash}
  - GET /api/scenarios/{id}
  - PATCH /api/scenarios/{id}/status
  - POST /api/protocols/bitcoin/transaction

💡 Provide realistic parameter values in your config file so tests can access existing resources

Schema validation mismatch: 9 operations mostly rejected generated data due to validation errors, indicating schema constraints don't match API validation

  - DELETE /api/scenarios/{id}
  - GET /api/scenarios/{id}
  - PATCH /api/scenarios/{id}/status
  - POST /api/proof/build
  - POST /api/proof/verify
  - POST /api/protocols/bitcoin/address
  - POST /api/protocols/bitcoin/transaction
  - POST /api/protocols/lightning/decode
  - POST /api/scenarios

💡 Check your schema constraints - API validation may be stricter than documented

=================================== SUMMARY ====================================

API Operations:
  Selected: 18/29
  Tested: 18

Test Phases:
  ⏭  Examples
  ✅ Coverage
  ✅ Fuzzing
  ✅ Stateful

Warnings:
  ⚠️ Missing valid test data: 5 operations repeatedly returned 404 responses
  ⚠️ Schema validation mismatch: 9 operations mostly rejected generated data

Test cases:
  2923 generated, 2923 passed, 110 skipped

Reports:
  - JUNIT: tests/schemathesis/report.xml

Seed: 91763281790518560640202875708426552493

============================ 2 warnings in 688.46s =============================
