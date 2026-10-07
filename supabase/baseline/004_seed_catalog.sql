-- Recovered static catalog used by growth paths, missions and achievements.
-- Safe to re-run: rows are keyed by stable IDs and updated in place.

insert into public.skill_paths (id, title, description, sort_order) values
  ('school', 'Школа', 'Самостоятельность в учёбе, планирование, умение просить помощь и делать выводы.', 1),
  ('football', 'Футбол', 'Дисциплина, техника, командная игра, устойчивость и лидерство на поле.', 2),
  ('chess', 'Шахматы', 'Тактика, стратегия, анализ ошибок и постепенный переход к наставничеству.', 3),
  ('english', 'English', 'Путь от коротких фраз к уверенному реальному общению.', 4),
  ('leadership', 'Лидерство', 'Ответственность, самостоятельность, инициатива, решения, влияние и наставничество.', 5),
  ('together', 'Папа & Я', 'Разговоры, совместные дела, встречи, традиции и семейная история.', 6)
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  sort_order = excluded.sort_order;

insert into public.skill_nodes (
  id, path_id, title, description, stage_order,
  recommended_age_from, recommended_age_to, node_type, hidden
) values
  ('school.ask-help','school','Умею просить помощь','Замечать, когда нужна помощь, и спокойно просить её у взрослого или учителя.',10,10,13,'growth',false),
  ('school.week-goal','school','Цель недели','Самостоятельно выбирать одну учебную цель и доводить её до результата.',20,11,14,'growth',false),
  ('school.plan','school','План подготовки','Разбивать большую учебную задачу на небольшие шаги и распределять время.',30,12,15,'growth',false),
  ('school.reflect','school','Учусь на опыте','После контрольной или проекта понимать, что помогло, а что стоит изменить.',40,12,16,'growth',false),
  ('school.project','school','Самостоятельный проект','Спланировать и выполнить значимый учебный проект с минимальной помощью взрослых.',50,13,17,'milestone',false),
  ('school.self-direction','school','Свой учебный курс','Самому ставить учебные цели и выбирать способы их достижения.',60,15,18,'growth',false),
  ('school.mentor','school','Могу объяснить другому','Помочь другому человеку разобраться в теме, которую сам хорошо понял.',70,15,18,'mentor',false),

  ('football.ready','football','Готов к тренировке','Самостоятельно готовить форму и всё необходимое к тренировке.',10,10,13,'growth',false),
  ('football.reflect','football','Вижу свою игру','После тренировки назвать сильный момент и одну точку роста.',20,11,14,'growth',false),
  ('football.team','football','Игрок команды','Замечать партнёров и выбирать решение не только ради личного результата.',30,11,16,'growth',false),
  ('football.resilience','football','Возвращаюсь после поражения','После неудачной игры вернуться к тренировке и сделать выводы.',40,11,18,'milestone',true),
  ('football.tactics','football','Понимаю игру','Объяснять позицию, эпизод или тактическое решение, а не только результат.',50,12,17,'growth',false),
  ('football.lead','football','Лидер на поле','Поддерживать партнёров, брать ответственность и помогать команде собраться.',60,13,18,'growth',false),
  ('football.mentor','football','Помогаю младшим','Подсказать или поддержать менее опытного игрока без превосходства над ним.',70,15,18,'mentor',false),

  ('chess.finish','chess','Первая длинная партия','Доиграть партию до конца и сохранить её как часть общей истории.',10,10,13,'milestone',false),
  ('chess.tactics','chess','Тактик','Регулярно видеть простые тактические идеи и решать позиции.',20,11,14,'growth',false),
  ('chess.loss','chess','Умею проигрывать','После поражения найти полезный момент вместо поиска оправданий.',30,11,18,'milestone',true),
  ('chess.plan','chess','Стратег','Перед ходом формулировать план и сравнивать несколько вариантов.',40,12,16,'growth',false),
  ('chess.analysis','chess','Аналитик','Разбирать завершённую партию и находить собственные ключевые решения.',50,13,18,'growth',false),
  ('chess.dad-win','chess','Первая победа над папой','Однажды выиграть полноценную партию у Михаила.',60,11,18,'milestone',true),
  ('chess.mentor','chess','Наставник','Объяснить другому игроку идею, позицию или типовую ошибку.',70,15,18,'mentor',false),

  ('english.first-voice','english','Говорить не страшно','Записать первые короткие голосовые на английском без страха ошибиться.',10,10,13,'growth',false),
  ('english.minute','english','Первая минута','Говорить на английском около минуты без перехода на русский.',20,11,14,'milestone',false),
  ('english.dialogue','english','Живой диалог','Поддержать небольшой разговор с Михаилом вопросами и ответами.',30,11,15,'growth',false),
  ('english.five-minutes','english','Пять минут English','Провести разговор около пяти минут преимущественно на английском.',40,12,16,'milestone',false),
  ('english.real-life','english','English в жизни','Использовать английский в реальной ситуации вне учебного задания.',50,12,18,'milestone',true),
  ('english.fifteen-minutes','english','Уверенный разговор','Поддерживать разговор около пятнадцати минут без подготовки.',60,14,18,'growth',false),
  ('english.help','english','Могу помочь другому','Объяснить другому человеку фразу, слово или правило простыми словами.',70,15,18,'mentor',false),

  ('leadership.responsibility','leadership','Ответственность','Помнить и выполнять собственные обязательства.',10,10,13,'growth',false),
  ('leadership.independence','leadership','Самостоятельность','Планировать и решать посильные задачи без постоянных напоминаний.',20,11,14,'growth',false),
  ('leadership.initiative','leadership','Инициатива','Замечать возможность и первым предлагать действие или решение.',30,11,15,'growth',false),
  ('leadership.communication','leadership','Коммуникация','Спокойно объяснять свою позицию и слышать другого человека.',40,12,16,'growth',false),
  ('leadership.decisions','leadership','Решения','Выбирать между вариантами и уметь объяснить свой выбор.',50,13,17,'growth',false),
  ('leadership.teamwork','leadership','Командная работа','Думать не только о своём результате, но и о результате команды.',60,12,18,'growth',false),
  ('leadership.resilience','leadership','Устойчивость','Возвращаться к делу после ошибки, неудачи или поражения.',70,11,18,'milestone',true),
  ('leadership.influence','leadership','Влияние','Помогать группе двигаться вперёд без давления и статуса.',80,14,18,'growth',false),
  ('leadership.mentoring','leadership','Наставничество','Передавать свой опыт и помогать младшим или менее опытным.',90,15,18,'mentor',false),

  ('together.check-in','together','Мы на связи','Сформировать привычку иногда делиться не отчётом, а настоящим моментом дня.',10,10,13,'growth',false),
  ('together.questions','together','Спрашиваем по-настоящему','Обсуждать вопросы, которые помогают узнавать друг друга глубже.',20,11,15,'growth',false),
  ('together.ritual','together','Наша традиция','Создать повторяющийся совместный ритуал, который нравится обоим.',30,11,18,'milestone',false),
  ('together.project','together','Наш общий проект','Придумать и довести до конца дело, в котором есть вклад Михаила и Артура.',40,12,18,'milestone',false),
  ('together.hard-talk','together','Сложный разговор','Открыто обсудить непростую тему и остаться на одной стороне.',50,12,18,'milestone',true),
  ('together.adventure','together','Большое приключение','Спланировать и прожить важную совместную поездку или событие.',60,11,18,'milestone',false),
  ('together.grown-up','together','От папы к взрослому сыну','Сохранить отношения, в которых можно говорить честно и принимать самостоятельность друг друга.',70,16,18,'growth',false)
on conflict (id) do update set
  path_id = excluded.path_id,
  title = excluded.title,
  description = excluded.description,
  stage_order = excluded.stage_order,
  recommended_age_from = excluded.recommended_age_from,
  recommended_age_to = excluded.recommended_age_to,
  node_type = excluded.node_type,
  hidden = excluded.hidden;

insert into public.achievement_definitions (
  id, category, title, description, tier, hidden, rule_version, rule
) values
  ('school.first_mission','school','Первый учебный шаг','Первая выполненная миссия в направлении «Школа».',1,false,1,'{"type":"mission_count","count":1}'::jsonb),
  ('school.project_milestone','school','Самостоятельный проект','Довёл до результата самостоятельный учебный проект.',2,false,1,'{"type":"skill_node","node_id":"school.project"}'::jsonb),

  ('football.first_mission','football','Миссия на поле','Первая выполненная футбольная миссия.',1,false,1,'{"type":"mission_count","count":1}'::jsonb),
  ('football.team_player','football','Игрок команды','Проявил себя как игрок, который думает о результате команды.',2,false,1,'{"type":"skill_node","node_id":"football.team"}'::jsonb),
  ('football.return_after_loss','football','Камбэк','Вернуться к тренировке после трудного поражения.',2,true,1,'{"type":"manual_milestone"}'::jsonb),

  ('chess.first_game','chess','Первая партия','Первая завершённая шахматная партия Михаила и Артура.',1,false,1,'{"type":"event_count","count":1,"event":"chess_game_completed"}'::jsonb),
  ('chess.first_mission','chess','Шахматный шаг','Первая выполненная шахматная миссия.',1,false,1,'{"type":"mission_count","count":1}'::jsonb),
  ('chess.analysis_milestone','chess','Разобрал свою партию','Не просто сыграл, а самостоятельно разобрал решения и ошибки.',2,false,1,'{"type":"skill_node","node_id":"chess.analysis"}'::jsonb),

  ('english.first_mission','english','English в деле','Первая выполненная миссия на английском.',1,false,1,'{"type":"mission_count","count":1}'::jsonb),
  ('english.first_minute','english','Первая минута English','Смог говорить на английском целую минуту.',2,false,1,'{"type":"skill_node","node_id":"english.minute"}'::jsonb),

  ('leadership.first_mission','leadership','Первый лидерский шаг','Первая выполненная миссия в направлении «Лидерство».',1,false,1,'{"type":"mission_count","count":1}'::jsonb),
  ('leadership.initiative','leadership','Инициатива','Самому заметить возможность и предложить решение.',1,false,1,'{"type":"recognition","quality":"initiative"}'::jsonb),
  ('leadership.initiative_milestone','leadership','Проявил инициативу','Сам заметил возможность и предложил действие или решение.',2,false,1,'{"type":"skill_node","node_id":"leadership.initiative"}'::jsonb),

  ('together.first_mission','together','Сделали вместе','Первая выполненная совместная миссия Михаила и Артура.',1,false,1,'{"type":"mission_count","count":1}'::jsonb),
  ('together.first_voice','together','Первый голос','Первое сохранённое голосовое друг другу.',1,false,1,'{"type":"event_count","count":1,"event":"voice_message"}'::jsonb),
  ('together.our_ritual','together','Наша традиция','У Михаила и Артура появилась собственная повторяющаяся традиция.',2,false,1,'{"type":"skill_node","node_id":"together.ritual"}'::jsonb),
  ('together.100_conversations','together','Сто разговоров','100 моментов осознанного общения Михаила и Артура.',3,false,1,'{"type":"event_count","count":100,"event":"conversation"}'::jsonb)
on conflict (id) do update set
  category = excluded.category,
  title = excluded.title,
  description = excluded.description,
  tier = excluded.tier,
  hidden = excluded.hidden,
  rule_version = excluded.rule_version,
  rule = excluded.rule;
