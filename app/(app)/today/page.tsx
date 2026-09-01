import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { dateLabel } from "@/lib/life-os/date";
import { getTodayView } from "@/lib/life-os/service";
import { TodayControl } from "@/components/today-control";
import { getIntelligenceView } from "@/lib/intelligence/service";
import { rankPriorities } from "@/lib/intelligence/analysis";
import { AskLifeOs } from "@/components/ask-life-os";

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ checkedIn?: string; date?: string }> }) {
  const user = await requireUser(); const params = await searchParams; const requested=params.date?new Date(`${params.date}T12:00:00.000Z`):undefined; const [state, intelligence] = await Promise.all([getTodayView(user.id, requested), getIntelligenceView(user.id)]);
  const done = (type: "task" | "habit" | "supplement", targetId: string) => type === "task" ? state.taskCompletions.some((item) => item.taskId === targetId && item.state === "COMPLETED") : type === "habit" ? state.habitCompletions.some((item) => item.habitId === targetId && item.state === "COMPLETED") : state.supplementLogs.some((item) => item.supplementId === targetId && item.state === "COMPLETED");
  const items=[...state.tasks.map(x=>({id:x.id,title:x.title,meta:x.priority.replaceAll("_"," "),type:"task" as const,done:done("task",x.id)})),...state.supplements.map(x=>({id:x.id,title:x.name,meta:`${x.intendedDose??""} ${x.doseUnit??""}`,type:"supplement" as const,done:done("supplement",x.id)})),...state.habits.map(x=>({id:x.id,title:x.name,meta:x.lifeArea.name,type:"habit" as const,done:done("habit",x.id)}))];
  const scoreParts = state.parts.map((part) => ({ ...part, details: part.details && typeof part.details === "object" && "ratio" in part.details && "target" in part.details && "actual" in part.details && "reason" in part.details ? part.details as { ratio: number; target: string; actual: string; reason: string } : null }));
  const prev=new Date(state.date);prev.setDate(prev.getDate()-1);const next=new Date(state.date);next.setDate(next.getDate()+1);const link=(d:Date)=>`/today?date=${d.toISOString().slice(0,10)}`;
  const priorities = rankPriorities(intelligence.pathways.filter((pathway) => pathway.status === "ACTIVE").flatMap((pathway) => pathway.actions.map((action) => ({
    id: action.id, title: action.title, reason: action.rationale, goal: pathway.objective.title,
    importance: Math.max(1, 6 - pathway.objective.priority), trajectory: pathway.trajectoryStatus,
    proximity: pathway.milestones.findIndex((item) => item.status === "ACTIVE") === 0 ? 4 : 2,
    urgency: pathway.trajectoryStatus === "BEHIND" ? 4 : 1, neglect: pathway.trajectoryStatus === "STALLED" ? 3 : 0,
    impact: Math.max(1, 6 - action.priority)
  }))));
  return <div className="page">{params.checkedIn?<p className="notice">Check-in complete. Score refreshed.</p>:null}<AskLifeOs prompts={state.status==="ON_TRACK"?["What is working?","Do I need to change anything?"]:["What should I focus on today?","What is holding me back?"]}/><div className="date-rail"><Link href={link(prev)}>← Previous</Link><span>{dateLabel(state.date)}{!state.isToday?" · History":""}</span>{state.isToday?<span/>:<Link href={link(next)}>Next →</Link>}</div>{state.isToday&&priorities.length?<section className="today-priorities"><p className="eyebrow">What matters today</p><h3>{priorities.length} things move the route forward</h3>{priorities.map((item,index)=><article key={item.id}><strong>0{index+1}</strong><div><b>{item.title}</b><span>Moves: {item.goal}</span><small>{item.reason}</small></div></article>)}</section>:null}{state.isToday?<TodayControl score={state.score} status={state.status} parts={scoreParts} items={items}/>:<section className="history-view"><p className="eyebrow">Historical day</p><h2>{state.score}</h2><p>{state.summary}</p><div className="history-grid"><History label="Actions" value={`${state.taskCompletions.length} completed`} /><History label="Habits" value={`${state.habitCompletions.length} recorded`} /><History label="Supplements" value={`${state.supplementLogs.length} logged`} /><History label="Metrics" value={`${state.entries.length} captured`} /></div>{state.checkIn?<p className="history-note">{state.checkIn.reflection || "Check-in recorded."}</p>:<p className="history-note">No check-in recorded.</p>}</section>}{state.alerts.length?<section className="panel alert-grid">{state.alerts.map(alert=><article key={alert.id} className="alert"><strong>{alert.title}</strong><p>{alert.recommendedAction}</p></article>)}</section>:null}</div>;
}
function History({label,value}:{label:string;value:string}){return <div><small>{label}</small><strong>{value}</strong></div>}
