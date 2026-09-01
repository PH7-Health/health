import { describe, expect, it } from "vitest";
import { classifyInput, confidenceFor, detectTradeOff, rankPriorities, weeklyRecommendation } from "./analysis";
const d=(n:number)=>new Date(Date.now()-n*86_400_000);
describe("deterministic intelligence analysis",()=>{
 it("classifies input value without deactivating it",()=>{expect(classifyInput({pathwayLinked:true,scoreRelevant:false,driftRelevant:false,loggedCount:0,frequency:"DAILY"})).toBe("REQUIRED");expect(classifyInput({pathwayLinked:false,scoreRelevant:false,driftRelevant:false,loggedCount:9,frequency:"DAILY"})).toBe("LOW_VALUE");expect(classifyInput({pathwayLinked:false,scoreRelevant:false,driftRelevant:false,loggedCount:0,frequency:"DAILY"})).toBe("UNCONNECTED")});
 it("detects trade-offs cautiously",()=>{const result=detectTradeOff({work:[{date:d(10),value:1},{date:d(1),value:4}],sleep:[{date:d(10),value:8},{date:d(1),value:6}],relationships:[]});expect(result?.title).toContain("sleep");expect(result?.explanation).toContain("does not establish causation")});
 it("ranks only the three highest leverage actions",()=>{expect(rankPriorities([{importance:1,trajectory:"ON_TRACK",proximity:1,urgency:1,neglect:1,impact:1},{importance:4,trajectory:"BEHIND",proximity:4,urgency:3,neglect:2,impact:3},{importance:2,trajectory:"ON_TRACK",proximity:1,urgency:1,neglect:1,impact:1},{importance:3,trajectory:"STALLED",proximity:3,urgency:3,neglect:2,impact:2}])).toHaveLength(3)});
 it("allows no-change weekly review and handles low data confidence",()=>{expect(weeklyRecommendation({improved:["Sleep"],deteriorated:[],neglected:[]}).title).toBe("No change required");expect(confidenceFor([{date:d(1),value:1}])).toBe("INSUFFICIENT_DATA")});
});
