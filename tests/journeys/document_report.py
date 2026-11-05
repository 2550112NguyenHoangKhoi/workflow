"""Feature report for ANY PDF: uploads it and prints what every offline feature produces
(chat, notes, quiz, flashcards, concept map, exam, study doc/plan, roadmap, teach-back, search,
suggestions) so a human can judge the quality. Needs the backend on :8000.
Usage: python tests/journeys/document_report.py <file.pdf>  (edit the chat questions for your subject)"""
import json, sys, time, requests
B="http://127.0.0.1:8000"; OFF="OFFLINE"; PDF=sys.argv[1]
def post(p,b,**k): t=time.time(); r=requests.post(B+p,json=b,timeout=300,**k); return r, time.time()-t
def get(p,**k): t=time.time(); r=requests.get(B+p,timeout=300,**k); return r, time.time()-t
def show(name, r, dt, body=None, n=900):
    print(f"\n===== {name}  [{r.status_code}, {dt:.1f}s]")
    print((body if body is not None else r.text)[:n])
t=time.time()
r=requests.post(B+"/api/documents/upload",files={"file":("Slide_Automatnew.pdf",open(PDF,"rb"),"application/pdf")},timeout=300)
did=r.json()["id"]; show("upload",r,time.time()-t)
r,dt=get(f"/api/documents/{did}"); d=r.json(); print("pages",len(d["pages"]),"chars",len(d["content"]))
for q in ["What is an alphabet?","How is the empty string denoted?","What is the difference between a DFA and an NFA?","Automaton là gì?"]:
    r,dt=post("/api/chat",{"message":q,"document_id":did,"api_key":OFF}); show("chat: "+q,r,dt,r.json().get("response",r.text),700)
r,dt=get(f"/api/documents/{did}/notes",params={"api_key":OFF,"regenerate":"true"}); show("smart notes",r,dt,json.dumps(r.json(),ensure_ascii=False,indent=1),1500)
r,dt=post("/api/generate_quiz",{"topic_or_text":"","document_id":did,"api_key":OFF}); q=r.json()
show("quiz",r,dt,"\n".join(f"- {x['question']} | {[o['text'] for o in x['options']]} ✓{x['correct_option_id']}" for x in (q.get('questions') or [])),2500)
r,dt=post("/api/generate_flashcards",{"topic_or_text":"","document_id":did,"api_key":OFF}); f=r.json()
show("flashcards",r,dt,"\n".join(f"- {c['front']}  →  {c['back']}" for c in f.get('flashcards',[])[:12]),2500)
r,dt=post("/api/generate_map",{"topic_or_text":"","document_id":did,"api_key":OFF}); m=r.json()
show("concept map",r,dt,f"nodes: {[n['label'] for n in m.get('nodes',[])]}\nedges: {len(m.get('edges',[]))}",1200)
r,dt=post("/api/exams/generate",{"title":"Automata","num_questions":10,"question_types":["mcq","true_false","short_answer","essay"],"sources":[{"type":"document","value":str(did)}],"api_key":OFF})
e=r.json(); show("exam",r,dt,"\n".join(f"- [{x['type']}] {x['question'][:160]} | ans={str(x.get('answer'))[:60]} | {x.get('source_ref')}" for x in e.get('questions',[])),3500)
r,dt=post("/api/examdocs/generate",{"title":"Ôn thi automata","sources":[{"type":"document","value":str(did)}],"api_key":OFF}); show("exam study doc",r,dt,n=1200)
for ep in ("generate_study_plan","generate_exam_prep"):
    r,dt=post(f"/api/{ep}",{"topic_or_text":"","document_id":did,"api_key":OFF}); show(ep,r,dt,n=1000)
r,dt=post(f"/api/documents/{did}/roadmap/generate",{"topic_or_text":"","api_key":OFF}); r2,_=get(f"/api/documents/{did}/roadmap"); show("roadmap",r,dt,r2.text,1500)
r,dt=post("/api/score_difficulty",{"topic_or_text":d["content"][:20000],"api_key":OFF}); show("difficulty",r,dt,n=300)
r,dt=post("/api/teachback/start",{"topic":"Deterministic finite automaton","document_id":did,"api_key":OFF}); tb=r.json(); show("teachback start",r,dt,n=600)
expl="A deterministic finite automaton has a finite set of states, an input alphabet, a transition function that gives exactly one next state for each state and symbol, a start state and a set of accepting states. It reads a string symbol by symbol and accepts it if it ends in an accepting state."
r,dt=post("/api/teachback/evaluate",{"concept":tb.get("concept",""),"key_points":tb.get("key_points",[]),"explanation":expl,"api_key":OFF}); show("teachback evaluate",r,dt,n=700)
r,dt=post("/api/search",{"query":"deterministic finite automaton tutorial"}); show("search",r,dt,"\n".join(x["title"] for x in r.json().get("results",[])) if r.ok else r.text)
r,dt=post("/api/suggestions",{"topic_or_text":d["content"][:5000],"api_key":OFF}); show("suggestions",r,dt,n=400)
r,dt=get(f"/api/documents/{did}/progress"); show("progress",r,dt,n=400)
