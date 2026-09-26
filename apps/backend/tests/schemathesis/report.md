/home/vikky/.local/lib/python3.10/site-packages/requests/__init__.py:113: RequestsDependencyWarning: urllib3 (2.6.3) or chardet (7.6.0)/charset_normalizer (3.4.4) doesn't match a supported version!
  warnings.warn(
Schemathesis v4.24.3
━━━━━━━━━━━━━━━━━━━━


 ✅  Loaded specification from openapi.yaml (in 0.20s)                          

     Base URL:         http://localhost:3000                                    
     Specification:    Open API 3.1.0                                           
     Operations:       3 selected / 15 total                                    


 ✅  API capabilities:                                                          

     Supports NULL byte in headers:                            ✘                
     Accepts backslash and control characters in URL paths:    ✓                

 ⏭   Examples (in 0.11s)                                                        
                                                                                
     ⏭  3 skipped                                                               

 ✅  Coverage (in 2.72s)                                                        
                                                                                
     ✅ 3 passed                                                                

 ✅  Fuzzing (in 56.86s)                                                        
                                                                                
     ✅ 3 passed                                                                

 ✅  Stateful (in 63.06s)                                                       

     Scenarios:    126                                                          
     API Links:    0 covered / 1 selected / 1 total (1 inferred)                

     ✅ 126 passed                                                              

=================================== WARNINGS ===================================

Missing test data: 3 operations repeatedly returned 404 Not Found, preventing tests from reaching your API's core logic

  - GET /api/graph/{id}
  - POST /api/analyze
  - POST /api/paths

💡 Provide realistic parameter values in your config file so tests can access existing resources

Schema validation mismatch: 2 operations mostly rejected generated data due to validation errors, indicating schema constraints don't match API validation

  - POST /api/analyze
  - POST /api/paths

💡 Check your schema constraints - API validation may be stricter than documented

=================================== SUMMARY ====================================

API Operations:
  Selected: 3/15
  Tested: 3

Test Phases:
  ⏭  Examples
  ✅ Coverage
  ✅ Fuzzing
  ✅ Stateful

Warnings:
  ⚠️ Missing valid test data: 3 operations repeatedly returned 404 responses
  ⚠️ Schema validation mismatch: 2 operations mostly rejected generated data

Test cases:
  919 generated, 919 passed, 1 skipped

Reports:
  - JUNIT: tests/schemathesis/report.xml

Seed: 99373965720959961248986362347081973040

============================ 2 warnings in 122.83s =============================
