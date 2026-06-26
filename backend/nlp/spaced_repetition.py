from pydantic import BaseModel
from datetime import date, timedelta

class CardState(BaseModel):
    interval: int = 1
    ease: float = 2.5
    repetitions: int = 0
    due: str = date.today().isoformat()

def sm2_update(state: CardState, quality: int) -> CardState:
    """
    SuperMemo-2 (SM-2) spaced repetition algorithm.
    quality: 0-5 (0 = complete blackout, 5 = perfect recall)
    """
    if quality < 3:
        state.repetitions = 0
        state.interval = 1
    else:
        state.repetitions += 1
        if state.repetitions == 1:
            state.interval = 1
        elif state.repetitions == 2:
            state.interval = 6
        else:
            state.interval = int(state.interval * state.ease)
            
    # Update ease factor
    state.ease = max(1.3, state.ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))
    
    # Calculate next due date
    next_due = date.today() + timedelta(days=state.interval)
    state.due = next_due.isoformat()
    
    return state
