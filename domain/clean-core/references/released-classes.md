# Released ABAP Classes — Quick Lookup

Read for: "which released class do I use for X in ABAP Cloud?". This is a starting point,
not proof: confirm the API state (C1) for the user's release in ADT or with the ABAP MCP
`sap_get_object_details` tool before recommending a class. The authoritative, maintained list
is SAP's ABAP cheat sheet *Released ABAP Classes* (link below).

---

## By task

| Task | Classes / interfaces |
|---|---|
| Console output (ADT) | `IF_OO_ADT_CLASSRUN` (`out->write( )`) |
| System date, time, user, client | `CL_ABAP_CONTEXT_INFO` (`get_system_date`, `get_system_time`, `get_user_technical_name`, `get_user_alias`) |
| UTC timestamps | `UTCLONG` built-ins, `CL_ABAP_UTCLONG`, `CL_ABAP_TSTMP`, `XCO_CP_TIME` |
| UUIDs | `CL_SYSTEM_UUID` (`create_uuid_x16_static`, `create_uuid_c36_static`), `XCO_CP=>uuid( )` |
| Number ranges | `CL_NUMBERRANGE_RUNTIME` |
| Application log | `CL_BALI_LOG`, `CL_BALI_*_SETTER`, `CL_BALI_LOG_DB` |
| Application jobs | `CL_APJ_RT_API` (schedule), `IF_APJ_DT_EXEC_OBJECT` / `IF_APJ_RT_EXEC_OBJECT` (job class) |
| Background processing (bgPF) | `CL_BGMC_PROCESS_FACTORY`, `IF_BGMC_OP_SINGLE` |
| Locks | `CL_ABAP_LOCK_OBJECT_FACTORY` |
| Parallel processing | `CL_ABAP_PARALLEL` |
| HTTP outbound | `CL_WEB_HTTP_CLIENT_MANAGER`, `CL_HTTP_DESTINATION_PROVIDER` (communication arrangement) |
| E-mail | `CL_BCS_MAIL_MESSAGE`, `CL_BCS_MAIL_TEXTPART` |
| JSON | `XCO_CP_JSON`, `/UI2/CL_JSON`, `CALL TRANSFORMATION id` with `CL_SXML_*` |
| XML | `CL_SXML_*`, `CL_IXML_CORE` |
| Excel (XLSX) | `XCO_CP_XLSX` |
| Zip / gzip | `CL_ABAP_ZIP`, `CL_ABAP_GZIP` |
| Codepages, Base64, URL encoding | `CL_ABAP_CONV_CODEPAGE`, `CL_WEB_HTTP_UTILITY` |
| Regular expressions | `CL_ABAP_REGEX`, `CL_ABAP_MATCHER` (or `FIND/REPLACE PCRE`) |
| Random numbers | `CL_ABAP_RANDOM_INT`, `CL_ABAP_RANDOM_PACKED`, … |
| RTTS / dynamic programming | `CL_ABAP_TYPEDESCR` hierarchy, `CL_ABAP_DYN_PRG` (input escaping), `CL_ABAP_CORRESPONDING` |
| Unit tests | `CL_ABAP_UNIT_ASSERT`, `CL_OSQL_TEST_ENVIRONMENT`, `CL_CDS_TEST_ENVIRONMENT`, `CL_BOTD_TXBUFDBL_BO_TEST_ENV`, `CL_BOTD_MOCKEMLAPI_BO_TEST_ENV` |
| PDF (Adobe Forms service) | `CL_FP_ADS_UTIL` |
| Repository metadata (generic) | `XCO_CP_ABAP_REPOSITORY`, `XCO_CP_CDS`, `XCO_CP_ABAP_DICTIONARY` |

## Examples

```abap
" [Environment: ABAP Cloud (S/4HANA Cloud Public, BTP ABAP Env, ABAP Cloud packages on-prem)]
DATA(today)   = cl_abap_context_info=>get_system_date( ).
DATA(now)     = utclong_current( ).
DATA(uuid)    = cl_system_uuid=>create_uuid_x16_static( ).

" Application log
DATA(log) = cl_bali_log=>create_with_header(
              header = cl_bali_header_setter=>create( object    = 'ZTRAVEL_LOG'
                                                      subobject = 'IMPORT' ) ).
log->add_item( item = cl_bali_free_text_setter=>create(
                        severity = if_bali_constants=>c_severity_warning
                        text     = 'Imported with warnings' ) ).
cl_bali_log_db=>get_instance( )->save_log( log = log assign_to_current_appl_job = abap_true ).
```

`CL_BALI_*` methods raise `CX_BALI_RUNTIME`; wrap calls in `TRY ... CATCH`. The log object
`ZTRAVEL_LOG` must exist (application log object in ADT).

## Sources

- Released ABAP classes cheat sheet → https://github.com/SAP-samples/abap-cheat-sheets/blob/main/22_Released_ABAP_Classes.md
- Cloudification Repository (released objects and successors) → https://github.com/SAP/abap-atc-cr-cv-s4hc
- Application log API (`CL_BALI_*`) → https://help.sap.com/docs/BTP/65de2977205c403bbc107264b8eccf4b/f8387789309344baafcf9a05bbe8059c.html
