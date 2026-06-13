import{a as w,d as A,e as R}from"./chunk-HKKGOGYT.js";import{b as h}from"./chunk-N6EDOTZW.js";import{S as p,X as y,Y as S,oa as u,u as v}from"./chunk-EM2PMNB4.js";var E=`You are a restaurant business analyst specialising in Indonesian F&B profitability. You receive a menu with estimated gross margins and 30-day sales data, then return a structured profitability assessment and prioritised action plan.

Rules:
1. Return ONLY valid JSON. No explanation, no markdown, no preamble.
2. Base all conclusions strictly on the data provided. Do not invent figures.
3. Suggestions must be specific, actionable, and grounded in the data.
4. Classify each menu item as one of: star (high margin + high volume), workhorse (low margin + high volume), niche (high margin + low volume), or deadweight (low margin + low volume).
5. Limit suggestions to a maximum of 5, ordered by estimated impact.
6. suggestion_type must be one of: bundle, sunset, reprice, promote, ingredient_swap.
7. estimated_impact must be a short quantitative estimate, max 6 words. Use format: "+ Rp X rb/month" for revenue gains, "- Rp X rb/month" for cost savings, "Rp X rb less waste/month" for efficiency. Use "rb" for thousands, "jt" for millions. No explanatory sentences.
8. Write all text fields (verdict_summary, description, title, estimated_impact) in English.

Output schema:
{
  "period_days": number,
  "total_revenue_idr": number,
  "total_cost_idr": number,
  "total_gross_profit_idr": number,
  "overall_margin_pct": number,
  "verdict": "profitable" | "break_even" | "loss",
  "verdict_summary": "string",
  "item_classifications": [
    { "menu_item": "string", "classification": "star|workhorse|niche|deadweight", "units_sold": number, "revenue_idr": number, "contribution_idr": number }
  ],
  "suggestions": [
    { "suggestion_type": "string", "title": "string", "description": "string", "items_involved": ["string"], "estimated_impact": "string" }
  ]
}`,g=class o{constructor(s,i){this.claudeApi=s;this.geminiApi=i}claudeApi;geminiApi;callAi(s,i){return w()==="gemini"?this.geminiApi.call({systemPrompt:s,userPrompt:i,temperature:.2}):this.claudeApi.call({systemPrompt:s,userPrompt:i,temperature:.2,maxTokens:4096})}analyseSalesData(s,i,r){let a=new Map;for(let t of i)for(let[d,l]of Object.entries(t.quantities))l!==void 0&&l>0&&a.set(d,(a.get(d)??0)+l);let m=s.filter(t=>t.status==="ready"||t.status==="incomplete").map(t=>({menu_item:t.name,selling_price_idr:t.selling_price_idr,est_cost_idr:t.est_cost_idr??0,gross_margin_pct:t.gross_margin_pct??0,units_sold:a.get(t.name)??0})),c=`Analyse this restaurant's menu performance over ${r} days.
Menu data: ${JSON.stringify(m)}
Each item has: menu_item, selling_price_idr, est_cost_idr, gross_margin_pct, units_sold.
Return the profitability assessment and suggestions JSON.`;return this.callAi(E,c).pipe(v(t=>this.parseAnalysisResponse(t,m)))}parseAnalysisResponse(s,i){let r;try{let e=s.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"").trim();r=JSON.parse(e)}catch{throw new Error("Failed to parse analysis response. Please try again.")}let a=r.item_classifications??r.items??[],m=new Map;for(let e of a)m.set(e.menu_item.toLowerCase(),e.classification);let c=i.map(e=>{let n=e.units_sold*e.selling_price_idr,f=e.units_sold*e.est_cost_idr,b=n-f,O=n>0?b/n*100:0,j=m.get(e.menu_item.toLowerCase())??"deadweight";return{menu_item:e.menu_item,units_sold:e.units_sold,revenue_idr:n,est_cost_idr:f,contribution_idr:b,margin_pct:O,classification:j}}),t=c.reduce((e,n)=>e+n.revenue_idr,0),d=c.reduce((e,n)=>e+n.est_cost_idr,0),l=t-d,_=t>0?l/t*100:0,I=_>2?"profitable":_<-2?"loss":"break_even",C={total_revenue_idr:t,total_cost_idr:d,total_gross_profit_idr:l,overall_margin_pct:_,verdict:I,verdict_summary:r.verdict_summary??""},M=(r.suggestions??[]).map((e,n)=>({id:n+1,suggestion_type:e.suggestion_type,title:e.title,description:e.description,items_involved:e.items_involved,estimated_impact:e.estimated_impact,review_status:"new"}));return{summary:C,items:c,suggestions:M}}static \u0275fac=function(i){return new(i||o)(y(A),y(R))};static \u0275prov=p({token:o,factory:o.\u0275fac,providedIn:"root"})};var P=class o{salesService=S(g);analysisResult=u(null);periodDays=u(0);uploadState=u("idle");parsedSales=u(null);analysisMessage=u("");analysisSub=null;runAnalysis(s,i,r){this.uploadState()!=="analyzing"&&(this.uploadState.set("analyzing"),this.analysisMessage.set(""),this.analysisSub?.unsubscribe(),this.analysisSub=this.salesService.analyseSalesData(s,i,r).subscribe({next:a=>{this.analysisResult.set(a),this.uploadState.set("results"),this.analysisSub=null,h("md_sales_uploaded_v1","true")||window.dispatchEvent(new CustomEvent("md:storage-error"))},error:a=>{this.analysisMessage.set(a instanceof Error?a.message:"Analysis failed. Please try again."),this.uploadState.set("preview"),this.analysisSub=null}}))}resetUpload(){this.analysisSub?.unsubscribe(),this.analysisSub=null,this.parsedSales.set(null),this.uploadState.set("idle"),this.analysisMessage.set("")}clear(){this.analysisSub?.unsubscribe(),this.analysisSub=null,this.analysisResult.set(null),this.periodDays.set(0),this.parsedSales.set(null),this.uploadState.set("idle"),this.analysisMessage.set("")}static \u0275fac=function(i){return new(i||o)};static \u0275prov=p({token:o,factory:o.\u0275fac,providedIn:"root"})};export{P as a};
