export const MODEL_PROVIDERS = {
 school: {label:'고려대학교 API', model:'gpt-6-luna', gateway:'https://api.baze.co/v1/gateway/chat/completions/'},
 openai: {label:'OpenAI API', model:'gpt-6-luna', gateway:'https://api.openai.com/v1/chat/completions'},
};

export function modelConfig(base,provider='school',model) {
 if(!Object.hasOwn(MODEL_PROVIDERS,provider))throw Error('지원하지 않는 API 제공자입니다.');
 return {...base,...MODEL_PROVIDERS[provider],provider,...(model?{model}:{})};
}
