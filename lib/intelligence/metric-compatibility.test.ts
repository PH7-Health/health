import { describe, expect, it } from "vitest";
import { selectPrimaryMetric } from "./metric-compatibility";
const suggestion=[] as never[];
describe("primary pathway metric compatibility",()=>{
 it("never binds 5K time to sleep duration",()=>{const result=selectPrimaryMetric({desired:"5K under 20 minutes",unit:"minutes",direction:"DECREASE"},[{id:"sleep",name:"Sleep duration",unit:"h",valueType:"NUMBER",direction:"INCREASE"}],suggestion);expect(result.existingMetricId).toBeNull()});
 it("selects a compatible performance duration metric",()=>{const result=selectPrimaryMetric({desired:"5K under 20 minutes",unit:"minutes",direction:"DECREASE"},[{id:"time",name:"5K completion time",unit:"minutes",valueType:"DURATION",direction:"DECREASE"}],suggestion);expect(result.existingMetricId).toBe("time")});
 it("does not bind body weight to sleep or time",()=>{const result=selectPrimaryMetric({desired:"Body weight 80 kg",unit:"kg",direction:"DECREASE"},[{id:"sleep",name:"Sleep duration",unit:"h",valueType:"NUMBER"},{id:"time",name:"5K time",unit:"minutes",valueType:"DURATION"}],suggestion);expect(result.existingMetricId).toBeNull()});
 it("ranks the explicit 5K metric above a generic time metric",()=>{const result=selectPrimaryMetric({desired:"5K under 20 minutes",unit:"minutes",direction:"DECREASE"},[{id:"generic",name:"Run time",unit:"minutes",valueType:"DURATION",direction:"DECREASE"},{id:"five",name:"5K completion time",unit:"minutes",valueType:"DURATION",direction:"DECREASE"}],suggestion);expect(result.existingMetricId).toBe("five")});
 it("creates a new metric when nothing compatible exists",()=>{const result=selectPrimaryMetric({desired:"5K under 20 minutes",unit:"minutes",direction:"DECREASE"},[],suggestion);expect(result.existingMetricId).toBeNull()});
});
