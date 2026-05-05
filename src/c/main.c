#include <node_api.h>
#include "daal.h"

// Initialize the N-API module
napi_value Init(napi_env env, napi_value exports) {
    napi_status status;
    napi_value fn;

    // Export the BuildSemanticGraph function
    status = napi_create_function(env, NULL, 0, BuildSemanticGraph, NULL, &fn);
    if (status != napi_ok) return NULL;

    status = napi_set_named_property(env, exports, "analyzeAst", fn);
    if (status != napi_ok) return NULL;

    return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
