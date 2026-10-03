/home/vikky/.local/lib/python3.10/site-packages/requests/__init__.py:113: RequestsDependencyWarning: urllib3 (2.6.3) or chardet (7.6.0)/charset_normalizer (3.4.4) doesn't match a supported version!
  warnings.warn(
Schemathesis v4.24.3
━━━━━━━━━━━━━━━━━━━━


 ✅  Loaded specification from openapi.yaml (in 0.26s)                          

     Base URL:         http://localhost:3000                                    
     Specification:    Open API 3.1.0                                           
     Operations:       30 selected / 33 total                                   


 ✅  API capabilities:                                                          

     Supports NULL byte in headers:                            ✘                
     Accepts backslash and control characters in URL paths:    ✓                

 ⏭   Examples (in 0.14s)                                                        
                                                                                
     ⏭  30 skipped                                                              

 ✅  Coverage (in 53.64s)                                                       
                                                                                
     ✅ 30 passed                                                               

 ✅  Fuzzing (in 349.24s)                                                       
                                                                                
     ✅ 30 passed                                                               

 ✅  Stateful (in 79.05s)                                                       

     Scenarios:    156                                                          
     API Links:    0 covered / 11 selected / 11 total (11 inferred)             

     ✅ 156 passed                                                              

=================================== WARNINGS ===================================

Missing test data: 7 operations repeatedly returned 404 Not Found, preventing tests from reaching your API's core logic

  - DELETE /api/scenarios/{id}
  - GET /api/proof/{bundleHash}
  - GET /api/scenarios/{id}
  - PATCH /api/scenarios/{id}/status
  - POST /api/ai/explain
  - POST /api/ai/summarize
  - POST /api/protocols/bitcoin/transaction

💡 Provide realistic parameter values in your config file so tests can access existing resources

Schema validation mismatch: 16 operations mostly rejected generated data due to validation errors, indicating schema constraints don't match API validation

  - DELETE /api/scenarios/{id}
  - GET /api/scenarios/{id}
  - PATCH /api/scenarios/{id}/status
  - POST /api/ai/explain
  - POST /api/ai/summarize
  - POST /api/onchain/derive
  - POST /api/onchain/psbt/broadcast
  - POST /api/onchain/psbt/build
  - POST /api/onchain/utxos
  - POST /api/orchestrator/orchestrate
  - POST /api/policy/check
  - POST /api/proof/build
  - POST /api/protocols/bitcoin/address
  - POST /api/protocols/bitcoin/transaction
  - POST /api/protocols/lightning/decode
  - POST /api/scenarios

💡 Check your schema constraints - API validation may be stricter than documented

=================================== SUMMARY ====================================

API Operations:
  Selected: 30/33
  Tested: 30

Test Phases:
  ⏭  Examples
  ✅ Coverage
  ✅ Fuzzing
  ✅ Stateful

Warnings:
  ⚠️ Missing valid test data: 7 operations repeatedly returned 404 responses
  ⚠️ Schema validation mismatch: 16 operations mostly rejected generated data

Test cases:
  4710 generated, 4710 passed, 186 skipped

Reports:
  - JUNIT: tests/schemathesis/report.xml

Seed: 296977544800008227835544796711338298123

============================ 2 warnings in 482.17s =============================
