import { describe, expect, it } from "vitest";
import { coachingAnswerSchema, weeklyCoachingSchema } from "./coaching-schema";
describe("coaching contracts",()=>{
 const answer={answer:"Continue the current strategy.",evidence:[{kind:"FACT",statement:"One observation exists.",source:"Metric history"}],hypotheses:[],recommendations:[],missingData:[],confidence:"LOW",continueCurrentStrategy:true};
 it("accepts grounded answers and rejects unbounded recommendations",()=>{expect(coachingAnswerSchema.parse(answer).confidence).toBe("LOW");expect(coachingAnswerSchema.safeParse({...answer,recommendations:Array(4).fill({action:"x",why:"y",confidence:"LOW"})}).success).toBe(false)});
 it("limits weekly priorities and permits no-change sections",()=>{expect(weeklyCoachingSchema.parse({weekInOneSentence:"No meaningful change.",biggestWin:null,biggestConcern:null,working:[],possibleLimiters:[],tradeOffs:[],continue:["Continue"],change:[],priorities:[],missingInformation:[],confidence:"INSUFFICIENT_DATA"}).continue).toHaveLength(1)});
});
