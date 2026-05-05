#ifndef DAAL_H
#define DAAL_H

#include <node_api.h>

// Semantic Graph Functions
napi_value BuildSemanticGraph(napi_env env, napi_callback_info info);

// Verification Functions
void VerifyLabelSelectors();
void DetectCycleDependencies();

// Security Functions
void ScanForSecrets();
void CheckTLSCompliance();
void CheckContextPoisoning();

#endif // DAAL_H
