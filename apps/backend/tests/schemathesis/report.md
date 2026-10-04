/home/vikky/.local/lib/python3.10/site-packages/requests/__init__.py:113: RequestsDependencyWarning: urllib3 (2.6.3) or chardet (7.6.0)/charset_normalizer (3.4.4) doesn't match a supported version!
  warnings.warn(
Schemathesis v4.24.3
━━━━━━━━━━━━━━━━━━━━


 ✅  Loaded specification from openapi.yaml (in 0.39s)                          

     Base URL:         http://localhost:3000                                    
     Specification:    Open API 3.1.0                                           
     Operations:       30 selected / 35 total                                   


 ✅  API capabilities:                                                          

     Supports NULL byte in headers:                            ✘                
     Accepts backslash and control characters in URL paths:    ✓                

 ⏭   Examples (in 0.22s)                                                        
                                                                                
     ⏭  30 skipped                                                              

 ✅  Coverage (in 15.98s)                                                       
                                                                                
     ✅ 30 passed                                                               

 ✅  Fuzzing (in 309.29s)                                                       
                                                                                
     ✅ 30 passed                                                               

 ✅  Stateful (in 58.21s)                                                       

     Scenarios:    308                                                          
     API Links:    3 covered / 11 selected / 11 total (11 inferred)             

     ✅ 308 passed                                                              

=================================== WARNINGS ===================================

Schema validation mismatch: 27 operations mostly rejected generated data due to validation errors, indicating schema constraints don't match API validation

  - DELETE /api/scenarios/{id}
  - GET /api/policy
  - GET /api/proof/scenario/{scenarioId}
  - GET /api/proof/{bundleHash}
  - GET /api/scenarios
  - GET /api/scenarios/{id}
  - PATCH /api/scenarios/{id}/status
  - POST /api/ai/explain
  - POST /api/ai/suggest
  - POST /api/ai/summarize
  - POST /api/onchain/derive
  - POST /api/onchain/fees
  - POST /api/onchain/psbt/broadcast
  - POST /api/onchain/psbt/build
  - POST /api/onchain/utxos
  - POST /api/orchestrator/orchestrate
  - POST /api/policy/check
  - POST /api/proof/build
  - POST /api/proof/verify
  - POST /api/protocols/bitcoin/tip
  - POST /api/protocols/bitcoin/transaction
  - POST /api/protocols/cashu/mint
  - POST /api/protocols/lightning/decode
  - POST /api/protocols/lightning/lookup
  - POST /api/protocols/nostr/event
  - POST /api/scenarios
  - PUT /api/policy

💡 Check your schema constraints - API validation may be stricter than documented

=================================== SUMMARY ====================================

API Operations:
  Selected: 30/35
  Tested: 30

Test Phases:
  ⏭  Examples
  ✅ Coverage
  ✅ Fuzzing
  ✅ Stateful

Warnings:
  ⚠️ Schema validation mismatch: 27 operations mostly rejected generated data

Test cases:
  5421 generated, 5421 passed, 187 skipped

Reports:
  - JUNIT: tests/schemathesis/report.xml

Seed: 240406511066339129564969254032231389755

============================= 1 warning in 383.84s =============================
