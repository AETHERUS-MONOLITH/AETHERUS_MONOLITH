export const FIXED = Object.freeze({
  operatorUserId: "4702d528-f7a7-4a04-a991-3176bec69f52",
  operatorPrincipalId: "e438b03c-c708-4cba-94e4-e106ee9958c4",
  workspaceId: "9abed891-7950-4937-a2aa-4b957d8a4bd1"
});

export function validateDecisionBody(input:unknown):{request_id:string;decision:"authorize"|"reject";reason:string|null} {
  if(!input||typeof input!=="object"||Array.isArray(input)) throw new Error("body invalid");
  const body=input as Record<string,unknown>;
  if(JSON.stringify(Object.keys(body).sort())!==JSON.stringify(["decision","reason","request_id"])) throw new Error("body fields mismatch");
  if(typeof body.request_id!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.request_id)) throw new Error("request ID invalid");
  if(body.decision!=="authorize"&&body.decision!=="reject") throw new Error("decision invalid");
  if(body.reason!==null&&(typeof body.reason!=="string"||body.reason.length>500)) throw new Error("reason invalid");
  return {request_id:body.request_id,decision:body.decision,reason:body.reason as string|null};
}

function publishableKey():string {
  const current=Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if(current){const keys=JSON.parse(current);if(typeof keys.default==="string"&&keys.default)return keys.default;}
  const legacy=Deno.env.get("SUPABASE_ANON_KEY");
  if(!legacy)throw new Error("publishable key unavailable");
  return legacy;
}

export async function authenticateFixedOperator(authorization:string):Promise<string> {
  const match=authorization.match(/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/);
  if(!match)throw new Error("invalid bearer token");
  const url=Deno.env.get("SUPABASE_URL"); if(!url)throw new Error("Supabase URL unavailable");
  const response=await fetch(`${url}/auth/v1/user`,{headers:{authorization:`Bearer ${match[1]}`,apikey:publishableKey()},redirect:"error"});
  if(!response.ok)throw new Error("Supabase session invalid"); const user=await response.json();
  if(user.id!==FIXED.operatorUserId)throw new Error("fixed Operator session required");
  return user.id;
}
