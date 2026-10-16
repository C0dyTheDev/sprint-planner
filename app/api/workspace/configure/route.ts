export const dynamic='force-dynamic';
// The fixed roster/cleanup operation is complete; this temporary endpoint is retired.
export async function POST(){return Response.json({error:'Configuration is disabled.'},{status:404,headers:{'Cache-Control':'no-store'}});}
