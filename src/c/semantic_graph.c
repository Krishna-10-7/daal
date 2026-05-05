#include <node_api.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "daal.h"

// A simple Error structure to return to JS
typedef struct {
    int startPosition;
    int endPosition;
    char message[256];
} CompilerDiagnostic;

CompilerDiagnostic diagnostics[100];
int diagnostic_count = 0;

void add_diagnostic(int start, int end, const char* msg) {
    if (diagnostic_count < 100) {
        diagnostics[diagnostic_count].startPosition = start;
        diagnostics[diagnostic_count].endPosition = end;
        strncpy(diagnostics[diagnostic_count].message, msg, 255);
        diagnostic_count++;
    }
}

// A simple recursive AST walker (Simplified for demonstration)
void TraverseAST(napi_env env, napi_value node) {
    napi_valuetype type;
    napi_typeof(env, node, &type);
    
    if (type == napi_object) {
        napi_value kind_val;
        napi_status status = napi_get_named_property(env, node, "kind", &kind_val);
        if (status == napi_ok) {
            int kind;
            napi_get_value_int32(env, kind_val, &kind);
            
            // Example Security Check: Check string values for secrets (Scalar = 0)
            if (kind == 0) { // SCALAR
                napi_value val_node;
                napi_get_named_property(env, node, "value", &val_node);
                napi_typeof(env, val_node, &type);
                if (type == napi_string) {
                    char str_val[256];
                    size_t result;
                    napi_get_value_string_utf8(env, val_node, str_val, 256, &result);
                    
                    // Secret Detection Mock
                    if (strstr(str_val, "AKIA") != NULL) {
                        napi_value start_val, end_val;
                        int start = 0, end = 0;
                        napi_get_named_property(env, node, "startPosition", &start_val);
                        napi_get_named_property(env, node, "endPosition", &end_val);
                        napi_get_value_int32(env, start_val, &start);
                        napi_get_value_int32(env, end_val, &end);
                        
                        add_diagnostic(start, end, "Security Error: Exposed AWS Access Key detected in AST node.");
                    }
                    
                    // Context Poisoning Mock
                    if (strstr(str_val, "ignore previous instructions") != NULL) {
                        napi_value start_val, end_val;
                        int start = 0, end = 0;
                        napi_get_named_property(env, node, "startPosition", &start_val);
                        napi_get_named_property(env, node, "endPosition", &end_val);
                        napi_get_value_int32(env, start_val, &start);
                        napi_get_value_int32(env, end_val, &end);
                        
                        add_diagnostic(start, end, "Security Error: Context Poisoning / Prompt Injection detected.");
                    }
                }
            }
        }
        
        // Traverse mappings
        napi_value mappings_val;
        if (napi_get_named_property(env, node, "mappings", &mappings_val) == napi_ok) {
            bool is_array;
            napi_is_array(env, mappings_val, &is_array);
            if (is_array) {
                uint32_t length;
                napi_get_array_length(env, mappings_val, &length);
                for (uint32_t i = 0; i < length; i++) {
                    napi_value element;
                    napi_get_element(env, mappings_val, i, &element);
                    TraverseAST(env, element);
                }
            }
        }
        
        // Traverse key and value (for MAPPING nodes)
        napi_value key_val, val_val;
        if (napi_get_named_property(env, node, "key", &key_val) == napi_ok) {
            TraverseAST(env, key_val);
        }
        if (napi_get_named_property(env, node, "value", &val_val) == napi_ok) {
            TraverseAST(env, val_val);
        }
        
        // Traverse items (for SEQ nodes)
        napi_value items_val;
        if (napi_get_named_property(env, node, "items", &items_val) == napi_ok) {
            bool is_array;
            napi_is_array(env, items_val, &is_array);
            if (is_array) {
                uint32_t length;
                napi_get_array_length(env, items_val, &length);
                for (uint32_t i = 0; i < length; i++) {
                    napi_value element;
                    napi_get_element(env, items_val, i, &element);
                    TraverseAST(env, element);
                }
            }
        }
    }
}

// Main Entry Point for the C Semantic Analyzer
napi_value BuildSemanticGraph(napi_env env, napi_callback_info info) {
    diagnostic_count = 0; // reset
    
    size_t argc = 1;
    napi_value args[1];
    napi_get_cb_info(env, info, &argc, args, NULL, NULL);

    if (argc < 1) {
        napi_throw_type_error(env, NULL, "Wrong number of arguments");
        return NULL;
    }

    // args[0] is the serialized AST from JS
    TraverseAST(env, args[0]);
    
    // Simulate Semantic Graph verification checks
    VerifyLabelSelectors();
    DetectCycleDependencies();
    
    // Create return array of diagnostics
    napi_value ret_arr;
    napi_create_array_with_length(env, diagnostic_count, &ret_arr);
    
    for (int i = 0; i < diagnostic_count; i++) {
        napi_value diag_obj;
        napi_create_object(env, &diag_obj);
        
        napi_value start_val, end_val, msg_val;
        napi_create_int32(env, diagnostics[i].startPosition, &start_val);
        napi_create_int32(env, diagnostics[i].endPosition, &end_val);
        napi_create_string_utf8(env, diagnostics[i].message, NAPI_AUTO_LENGTH, &msg_val);
        
        napi_set_named_property(env, diag_obj, "startPosition", start_val);
        napi_set_named_property(env, diag_obj, "endPosition", end_val);
        napi_set_named_property(env, diag_obj, "message", msg_val);
        
        napi_set_element(env, ret_arr, i, diag_obj);
    }

    return ret_arr;
}
