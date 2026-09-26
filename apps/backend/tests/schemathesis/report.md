/home/vikky/.local/lib/python3.10/site-packages/requests/__init__.py:113: RequestsDependencyWarning: urllib3 (2.6.3) or chardet (7.6.0)/charset_normalizer (3.4.4) doesn't match a supported version!
  warnings.warn(
Schemathesis v4.24.3
━━━━━━━━━━━━━━━━━━━━


 ✅  Loaded specification from openapi.yaml (in 0.22s)                          

     Base URL:         http://localhost:3000                                    
     Specification:    Open API 3.1.0                                           
     Operations:       4 selected / 18 total                                    


 ✅  API capabilities:                                                          

     Supports NULL byte in headers:                            ✘                
     Accepts backslash and control characters in URL paths:    ✓                

 ⏭   Examples (in 0.12s)                                                        
                                                                                
     ⏭  4 skipped                                                               

 ✅  Coverage (in 5.09s)                                                        
                                                                                
     ✅ 4 passed                                                                

 ✅  Fuzzing (in 83.58s)                                                        
                                                                                
     ✅ 4 passed                                                                

=================================== WARNINGS ===================================

Missing test data: 1 operation repeatedly returned 404 Not Found, preventing tests from reaching your API's core logic

  - GET /api/proof/{bundleHash}

💡 Provide realistic parameter values in your config file so tests can access existing resources

Schema validation mismatch: 2 operations mostly rejected generated data due to validation errors, indicating schema constraints don't match API validation

  - POST /api/proof/build
  - POST /api/proof/verify

💡 Check your schema constraints - API validation may be stricter than documented

=================================== SUMMARY ====================================

API Operations:
  Selected: 4/18
  Tested: 4

Test Phases:
  ⏭  Examples
  ✅ Coverage
  ✅ Fuzzing
  ⏭  Stateful (not applicable)

Warnings:
  ⚠️ Missing valid test data: 1 operation repeatedly returned 404 responses
  ⚠️ Schema validation mismatch: 2 operations mostly rejected generated data

Test cases:
  763 generated, 763 passed

Reports:
  - JUNIT: tests/schemathesis/report.xml

Seed: 4272353912275357943576700035464341795

============================= 2 warnings in 88.86s =============================
