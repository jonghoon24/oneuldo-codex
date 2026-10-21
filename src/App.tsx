import { useEffect, useRef, useState, type FormEvent } from 'react';
import { currentStreak, fullDateLabel, localDateKey, monthDays, monthLabel, monthlyAchievement, shiftMonth } from './dates';
import { loadData, saveData, validateName, validateStartDate, type Habit, type SavedData } from './storage';

type InitialState = { data: SavedData; error: string | null };

function getInitialState(): InitialState {
  try {
    return { data: loadData(), error: null };
  } catch {
    return {
      data: { version: 1, habits: [] },
      error: '저장된 데이터를 읽을 수 없습니다. 브라우저 저장소를 확인해 주세요. 기존 데이터는 변경되지 않았습니다.',
    };
  }
}

function App() {
  const [initial] = useState(getInitialState);
  const [data, setData] = useState(initial.data);
  const [fatalError, setFatalError] = useState<string | null>(initial.error);
  const [today, setToday] = useState(() => localDateKey(new Date()));
  const [requestedMonth, setRequestedMonth] = useState(() => localDateKey(new Date()).slice(0, 7));
  const [selectedId, setSelectedId] = useState<string | null>(initial.data.habits[0]?.id ?? null);
  const [newName, setNewName] = useState('');
  const [newNameError, setNewNameError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newStartDate, setNewStartDate] = useState(today);
  const [newStartError, setNewStartError] = useState<string | null>(null);
  const [editedStartDate, setEditedStartDate] = useState('');
  const [editStartError, setEditStartError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);

  const selected = data.habits.find((habit) => habit.id === selectedId) ?? null;
  const pendingDelete = data.habits.find((habit) => habit.id === pendingDeleteId) ?? null;
  const todayMonth = today.slice(0, 7);
  const firstMonth = selected && selected.createdAt < today ? selected.createdAt.slice(0, 7) : todayMonth;
  const visibleMonth = requestedMonth < firstMonth ? firstMonth : requestedMonth > todayMonth ? todayMonth : requestedMonth;

  useEffect(() => {
    function refreshToday() {
      const next = localDateKey(new Date());
      setToday((previous) => {
        if (previous !== next) {
          setRequestedMonth((current) => current === previous.slice(0, 7) ? next.slice(0, 7) : current);
        }
        return next;
      });
    }

    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timer = window.setTimeout(refreshToday, nextMidnight.getTime() - now.getTime() + 100);
    const interval = window.setInterval(refreshToday, 60_000);
    window.addEventListener('focus', refreshToday);
    document.addEventListener('visibilitychange', refreshToday);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshToday);
      document.removeEventListener('visibilitychange', refreshToday);
    };
  }, [today]);

  useEffect(() => {
    const dialog = deleteDialogRef.current;
    if (pendingDeleteId && dialog && !dialog.open) dialog.showModal();
    if (!pendingDeleteId && dialog?.open) dialog.close();
  }, [pendingDeleteId]);

  function commit(next: SavedData): boolean {
    if (fatalError) return false;
    try {
      saveData(next);
      setData(next);
      return true;
    } catch {
      closeAdd();
      setEditing(false);
      setFatalError('변경 내용을 저장하지 못했습니다. 화면의 변경을 취소했습니다. 브라우저 저장소를 확인해 주세요.');
      return false;
    }
  }

  function beginAdd() {
    if (fatalError) return;
    setNewName('');
    setNewStartDate(today);
    setNewNameError(null);
    setNewStartError(null);
    setAdding(true);
  }

  function closeAdd() {
    setAdding(false);
    setNewName('');
    setNewStartDate(today);
    setNewNameError(null);
    setNewStartError(null);
  }

  function addHabit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const error = validateName(newName, data.habits);
    const startDate = newStartDate;
    const startError = validateStartDate(startDate, today);
    setNewNameError(error);
    setNewStartError(startError);
    if (error || startError) return;
    const habit: Habit = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      createdAt: startDate,
      completedDates: [],
    };
    if (commit({ version: 1, habits: [...data.habits, habit] })) {
      setSelectedId(habit.id);
      setRequestedMonth(todayMonth);
      closeAdd();
      setEditing(false);
    }
  }

  function selectHabit(id: string) {
    setSelectedId(id);
    setRequestedMonth(todayMonth);
    setEditing(false);
    setEditError(null);
  }

  function toggleDate(habit: Habit, date: string) {
    if (fatalError || date < habit.createdAt || date > today) return;
    const completedDates = habit.completedDates.includes(date)
      ? habit.completedDates.filter((entry) => entry !== date)
      : [...habit.completedDates, date].sort();
    commit({
      version: 1,
      habits: data.habits.map((entry) => entry.id === habit.id ? { ...entry, completedDates } : entry),
    });
  }

  function beginEdit() {
    if (!selected || fatalError) return;
    setEditedStartDate(selected.createdAt);
    setEditStartError(null);
    setEditedName(selected.name);
    setEditError(null);
    setEditing(true);
  }

  function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const error = validateName(editedName, data.habits, selected.id);
    const startError = validateStartDate(editedStartDate, today, selected.completedDates);
    setEditError(error);
    setEditStartError(startError);
    if (error || startError) return;
    if (editedName.trim() === selected.name && editedStartDate === selected.createdAt) {
      setEditing(false);
      return;
    }
    if (commit({
      version: 1,
      habits: data.habits.map((habit) => habit.id === selected.id ? { ...habit, name: editedName.trim(), createdAt: editedStartDate } : habit),
    })) {
      setEditing(false);
      setEditError(null);
      setRequestedMonth(visibleMonth < editedStartDate.slice(0, 7) ? editedStartDate.slice(0, 7) : visibleMonth);
    }
  }

  function deleteHabit() {
    if (!pendingDelete) return;
    const index = data.habits.findIndex((habit) => habit.id === pendingDelete.id);
    const remaining = data.habits.filter((habit) => habit.id !== pendingDelete.id);
    const nextSelected = selectedId === pendingDelete.id
      ? remaining[index]?.id ?? remaining[index - 1]?.id ?? null
      : selectedId;
    if (commit({ version: 1, habits: remaining })) {
      setSelectedId(nextSelected);
      setRequestedMonth(todayMonth);
      setEditing(false);
    }
    setPendingDeleteId(null);
  }

  const calendarDays = selected ? monthDays(visibleMonth) : [];
  const achievement = selected ? monthlyAchievement(selected.completedDates, visibleMonth, today, selected.createdAt) : null;
  const streak = selected ? currentStreak(selected.completedDates, today) : 0;
  const todayCompleted = selected?.completedDates.includes(today) ?? false;
  const completedToday = data.habits.filter((habit) => habit.completedDates.includes(today)).length;
  const previousMonth = shiftMonth(visibleMonth, -1);
  const nextMonth = shiftMonth(visibleMonth, 1);

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">✓</span>
          <span>오늘도<span className="brand-period">.</span></span>
        </div>
        <div className="header-date">{fullDateLabel(today)} <span className="header-tagline">매일의 작은 성취</span></div>
      </header>

      <main className="main-content">
        <div className="intro">
          <div>
            <h1>오늘도, 하나씩.</h1>
            <p>해낸 습관에 체크하고, 나의 하루를 쌓아요.</p>
          </div>
          {data.habits.length > 0 && (
            <div className="today-summary" aria-live="polite">
              <span>{completedToday === data.habits.length ? '오늘의 습관을 모두 해냈어요!' : '오늘의 작은 성취'}</span>
              <strong>{completedToday}<span> / {data.habits.length} 완료</span></strong>
              <div className="summary-track" aria-hidden="true"><span style={{ width: `${completedToday / data.habits.length * 100}%` }} /></div>
            </div>
          )}
        </div>

        {fatalError && (
          <div className="fatal-alert" role="alert">
            <strong>저장소 오류</strong>
            <p>{fatalError}</p>
            <span>기록을 보호하기 위해 추가·수정·삭제·체크 기능을 중지했습니다.</span>
          </div>
        )}

        <div className="workspace">
          <section className="habits-panel card" aria-labelledby="habit-list-heading">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">체크로 채우는 하루</span>
                <h2 id="habit-list-heading" aria-label={`나의 습관 ${data.habits.length}`}>오늘 할 습관 <span className="count">{data.habits.length}</span></h2>
              </div>
              <button type="button" className="register-button" onClick={beginAdd}
                disabled={Boolean(fatalError) || adding} aria-expanded={adding} aria-controls="register-habit-form"><span aria-hidden="true">＋</span> 습관 등록</button>
            </div>
            {adding && (
              <form id="register-habit-form" className="add-form edit-form" onSubmit={addHabit}
                onKeyDown={(event) => { if (event.key === 'Escape') closeAdd(); }} noValidate>
                <label htmlFor="new-habit-name">새 습관 추가</label>
                <div className="edit-controls">
                  <input
                    id="new-habit-name"
                    autoFocus
                    value={newName}
                    onChange={(event) => { setNewName(event.target.value); setNewNameError(null); }}
                    placeholder="예: 물 한 잔 마시기"
                    aria-invalid={Boolean(newNameError)}
                    aria-describedby={newNameError ? 'new-habit-error' : undefined}
                    disabled={Boolean(fatalError)}
                  />
                </div>
                {newNameError && <p className="field-error" id="new-habit-error" role="alert">{newNameError}</p>}
                <div className="date-field">
                  <label htmlFor="new-start-date">시작일</label>
                  <input id="new-start-date" type="date" min="1900-01-01" max={today} value={newStartDate}
                    onChange={(event) => { setNewStartDate(event.target.value); setNewStartError(null); }}
                    disabled={Boolean(fatalError)} aria-invalid={Boolean(newStartError)} aria-describedby={newStartError ? 'new-start-error' : undefined} />
                  {newStartError && <p className="field-error" id="new-start-error" role="alert">{newStartError}</p>}
                </div>
                <div className="edit-controls edit-buttons">
                  <button type="submit" className="small-primary" disabled={Boolean(fatalError)}>등록</button>
                  <button type="button" className="small-plain" onClick={closeAdd}>취소</button>
                </div>
              </form>
            )}

            {data.habits.length === 0 ? (
              <div className="empty-habits">
                <div className="empty-illustration" aria-hidden="true"><span>✦</span><span>◌</span><span>✧</span></div>
                <h3>첫 습관을 시작해 볼까요?</h3>
                <p>매일 하고 싶은 일을 하나 적어 보세요.<br />지난 날짜도 기록할 수 있어요.</p>
                <button type="button" className="text-action" onClick={beginAdd} disabled={Boolean(fatalError) || adding}>첫 습관 등록하기 <span aria-hidden="true">↗</span></button>
              </div>
            ) : (
              <ul className="habit-list">
                {data.habits.map((habit) => {
                  const checked = habit.completedDates.includes(today);
                  return (
                    <li key={habit.id} className={`habit-row ${checked ? 'is-complete' : ''} ${selectedId === habit.id ? 'selected' : ''}`}>
                      <button
                        type="button"
                        className="habit-select"
                        onClick={() => selectHabit(habit.id)}
                        aria-current={selectedId === habit.id ? 'true' : undefined}
                        aria-label={`${habit.name} 선택, 현재 연속 ${currentStreak(habit.completedDates, today)}일`}
                      >
                        <span className="habit-name">{habit.name}</span>
                        <span className="habit-sub">{checked ? '오늘 완료' : '오늘도 이어가요'}<span className="habit-streak">연속 {currentStreak(habit.completedDates, today)}일</span></span>
                      </button>
                      <button
                        type="button"
                        className={`list-check ${checked ? 'checked' : ''}`}
                        onClick={() => toggleDate(habit, today)}
                        disabled={Boolean(fatalError) || habit.createdAt > today}
                        aria-label={`${habit.name}, 오늘 ${checked ? '완료 취소' : '완료하기'}`}
                        aria-pressed={checked}
                      ><span aria-hidden="true">✓</span></button>
                    </li>
                  );
                })}
              </ul>
            )}

            {data.habits.length > 0 && <p className="list-hint">습관 이름을 누르면 쌓아온 기록을 볼 수 있어요.</p>}
          </section>

          <section className="detail-panel card" aria-label="습관 상세">
            {selected ? (
              <>
                <div className="detail-top">
                  <div>
                    <span className="section-kicker">쌓아온 기록</span>
                    {editing ? (
                      <form className="edit-form" onSubmit={saveEdit} onKeyDown={(event) => { if (event.key === 'Escape') setEditing(false); }} noValidate>
                        <label htmlFor="edit-habit-name">습관 이름 변경</label>
                        <div className="edit-controls">
                          <input
                            id="edit-habit-name"
                            autoFocus
                            value={editedName}
                            onChange={(event) => { setEditedName(event.target.value); setEditError(null); }}
                            aria-invalid={Boolean(editError)}
                            aria-describedby={editError ? 'edit-habit-error' : undefined}
                            disabled={Boolean(fatalError)}
                          />
                        </div>
                        {editError && <p className="field-error" id="edit-habit-error" role="alert">{editError}</p>}
                        <div className="date-field">
                          <label htmlFor="edit-start-date">시작일</label>
                          <input id="edit-start-date" type="date" min="1900-01-01" max={today} value={editedStartDate}
                            onChange={(event) => { setEditedStartDate(event.target.value); setEditStartError(null); }}
                            disabled={Boolean(fatalError)} aria-invalid={Boolean(editStartError)} aria-describedby={editStartError ? 'edit-start-error' : undefined} />
                          {editStartError && <p className="field-error" id="edit-start-error" role="alert">{editStartError}</p>}
                        </div>
                        <div className="edit-controls edit-buttons">
                          <button type="submit" className="small-primary" disabled={Boolean(fatalError)}>저장</button>
                          <button type="button" className="small-plain" onClick={() => setEditing(false)}>취소</button>
                        </div>
                      </form>
                    ) : <h2>{selected.name}</h2>}
                  </div>
                  <div className="detail-actions">
                    <button type="button" onClick={beginEdit} disabled={Boolean(fatalError) || editing}>수정</button>
                    <button type="button" onClick={() => setPendingDeleteId(selected.id)} disabled={Boolean(fatalError)}>삭제</button>
                  </div>
                </div>

                <div className="progress-block">
                  <div className="streak-visual" aria-hidden="true">↗</div>
                  <div className="streak-copy">
                    <span>현재 연속 기록</span>
                    <strong>{streak}<small>일</small></strong>
                    <p>{streak === 0 ? '오늘부터 한 걸음씩 시작해요.' : '꾸준히 이어온 날들이에요.'}</p>
                  </div>
                  <button
                    type="button"
                    className={`today-button ${todayCompleted ? 'done' : ''}`}
                    onClick={() => toggleDate(selected, today)}
                    disabled={Boolean(fatalError) || selected.createdAt > today}
                    aria-pressed={todayCompleted}
                  ><span aria-hidden="true">{todayCompleted ? '✓' : '+'}</span>{todayCompleted ? '오늘 완료 · 취소하기' : '오늘 완료하기'}</button>
                </div>

                <div className="calendar-section">
                  <div className="calendar-header">
                    <div>
                      <h3>실천 달력</h3>
                    </div>
                    <div className="month-navigation">
                      <button type="button" onClick={() => setRequestedMonth(previousMonth)} disabled={previousMonth < firstMonth} aria-label="이전 달">‹</button>
                      <span aria-live="polite">{monthLabel(visibleMonth)}</span>
                      <button type="button" onClick={() => setRequestedMonth(nextMonth)} disabled={nextMonth > todayMonth} aria-label="다음 달">›</button>
                    </div>
                  </div>
                  {achievement && (
                    <p className="monthly-achievement">달성률 {achievement.percentage}% ({achievement.completedDays}/{achievement.availableDays}일)</p>
                  )}
                  <div className="calendar-grid" role="group" aria-label={`${monthLabel(visibleMonth)} 실천 기록`}>
                    {['월', '화', '수', '목', '금', '토', '일'].map((day) => <span className="weekday" key={day}>{day}</span>)}
                    {calendarDays.map((date, index) => {
                      if (!date) return <span key={`blank-${index}`} className="calendar-blank" aria-hidden="true" />;
                      const available = date >= selected.createdAt && date <= today;
                      const isStart = date === selected.createdAt;
                      const checked = available && selected.completedDates.includes(date);
                      const isToday = date === today;
                      const state = !available ? '기록 불가' : checked ? '완료' : '미완료';
                      return (
                        <button
                          type="button"
                          key={date}
                          className={`calendar-day ${checked ? 'completed' : ''} ${isToday ? 'today' : ''}`}
                          onClick={() => toggleDate(selected, date)}
                          disabled={!available || Boolean(fatalError)}
                          aria-pressed={available ? checked : undefined}
                          aria-label={`${fullDateLabel(date)}${isToday ? ', 오늘' : ''}${isStart ? ', 시작일' : ''}, ${state}${available ? ', 체크 전환' : ''}`}
                        >
                          {isStart && <span className="start-marker" aria-hidden="true">시작</span>}
                          <span className="day-number">{Number(date.slice(-2))}</span>
                          <span className="day-state" aria-hidden="true">{checked ? '✓' : isToday ? '오늘' : ''}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="calendar-legend"><span><i className="legend-complete" />완료</span><span><i className="legend-today" />오늘</span><span className="calendar-hint">날짜를 눌러 기록 수정</span></div>
                </div>
              </>
            ) : (
              <div className="empty-detail">
                <span className="empty-detail-art" aria-hidden="true">◌</span>
                <h2>어떤 습관을 쌓아 볼까요?</h2>
                <p>습관을 등록하면<br />오늘의 기록과 달력이 나타납니다.</p>
              </div>
            )}
          </section>
        </div>
      </main>

      <footer className="site-footer"><span>작은 체크가 모여, 나의 매일이 됩니다.</span><span className="storage-note">기록은 현재 브라우저에만 저장됩니다. 브라우저 데이터를 삭제하면 복구할 수 없어요.</span></footer>

      <dialog ref={deleteDialogRef} className="delete-dialog" onClose={() => setPendingDeleteId(null)} aria-labelledby="delete-title" aria-describedby="delete-description">
        <div className="dialog-icon" aria-hidden="true">!</div>
        <h2 id="delete-title">습관을 삭제할까요?</h2>
        <p id="delete-description"><strong>{pendingDelete?.name}</strong> 습관과 모든 체크 기록이 영구 삭제됩니다. 삭제 후에는 복구할 수 없습니다.</p>
        <div className="dialog-actions">
          <button type="button" onClick={() => setPendingDeleteId(null)}>취소</button>
          <button type="button" className="delete-confirm" onClick={deleteHabit}>삭제하기</button>
        </div>
      </dialog>
    </div>
  );
}

export default App;
