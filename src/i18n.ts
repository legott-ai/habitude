// UI localization (en/ko) for plugin chrome: views, commands, settings,
// notices, and user-visible error strings.
//
// Scope: plugin UI only. The AI coach's *reply* language is a separate user
// setting ("Coach language" in settings) and is untouched by this module.
// The locale is detected from Obsidian's own UI language setting; there is
// no per-plugin language switch.

export type UiLocale = 'en' | 'ko';

type Dict = Record<string, string>;

const en: Dict = {
	// Views & ribbon
	'view.checklist.title': 'Habitude checklist',
	'view.coach.title': 'Habitude AI coach',
	'ribbon.checklist': 'Habitude checklist',
	'ribbon.coach': 'Habitude AI coach',
	'notice.cannotOpenChecklist': 'Could not open the checklist view.',
	'notice.cannotOpenCoach': 'Could not open the AI coach.',
	'statusbar.today': '✓ {done}/{total} today',

	// Commands
	'cmd.openChecklist': 'Open checklist',
	'cmd.openCoach': 'Open AI coach',
	'cmd.openWeeklyReview': 'Open weekly review',
	'cmd.toggleToday': 'Toggle today for a habit',
	'cmd.pickHabitPlaceholder': 'Pick a habit to toggle for today…',
	'cmd.noHabitsYet': 'No habits yet. Open the checklist to add one.',
	'cmd.toggledChecked': '{title}: checked for today',
	'cmd.toggledUnchecked': '{title}: unchecked for today',

	// Settings
	'settings.dataFolder.name': 'Data folder',
	'settings.dataFolder.desc': 'Vault folder for Habits.md and daily Log notes.',
	'settings.dataFolder.placeholder': 'Habitude',
	'settings.weekStart.name': 'Week starts on',
	'settings.weekStart.desc': 'First day of the week in the checklist grid.',
	'settings.weekStart.monday': 'Monday',
	'settings.weekStart.sunday': 'Sunday',
	'settings.checkmarkColor.name': 'Checkmark color',
	'settings.checkmarkColor.desc':
		'Color of the ✓ mark on checked days. Open checklists update immediately.',
	'settings.provider.name': 'AI provider',
	'settings.provider.desc':
		'Which LLM service the AI coach talks to. Your key and chats are sent only to this provider — never to Habitude.',
	'settings.provider.gemini': 'Google Gemini',
	'settings.provider.openai': 'OpenAI',
	'settings.provider.anthropic': 'Anthropic Claude',
	'settings.provider.openrouter': 'OpenRouter',
	'settings.provider.ollama': 'Ollama (local)',
	'settings.provider.lmstudio': 'LM Studio (local)',
	'settings.provider.custom': 'Custom (OpenAI-compatible)',
	'settings.llmKey.name': 'API key (AI coach, optional)',
	'settings.llmKey.desc':
		'Your own key for the selected AI provider. Stored only on this device; sent only to that provider, never to Habitude.',
	'settings.llmKey.noKeyDesc':
		'No key needed — the selected provider runs on your own machine. Any key saved here is ignored.',
	'settings.llmKey.savedPlaceholder': '•••••••• (key saved)',
	'settings.llmKey.emptyPlaceholder': 'Paste key to enable the AI coach',
	'settings.llmModel.name': 'Coach model',
	'settings.llmModel.desc': 'Model ID used by the AI coach. Empty uses the provider default.',
	'settings.baseUrl.name': 'API base URL',
	'settings.baseUrl.desc': 'Optional override for the provider endpoint. Empty uses the provider default.',
	'settings.baseUrl.requiredDesc':
		'Required for the custom provider — the base URL of your OpenAI-compatible endpoint.',
	'settings.baseUrl.placeholder': 'Default: {url}',
	'settings.coachLanguage.name': 'Coach language',
	'settings.coachLanguage.desc': 'Reply language for the AI coach.',
	'settings.coachLanguage.auto': 'Auto (match me)',
	'settings.coachLanguage.english': 'English',
	'settings.coachLanguage.korean': '한국어',
	'settings.sharing.name': 'Sharing',
	'settings.sharing.desc':
		'Sharing runs only when you tap the button. Only aggregate stats — habit titles, streaks, completion rates — are sent; your note contents are never included.',

	// Cloud sync (Premium, opt-in)
	'cmd.syncNow': 'Sync now (cloud)',
	'cmd.syncNowDisabled': 'Cloud sync is off. Enable it in Settings → Habitude checklist.',
	'cmd.syncDone': 'Cloud sync complete: {pushed} pushed, {pulled} pulled.',
	'cmd.syncFailed': 'Cloud sync failed: {detail}',
	'settings.cloud.section': 'Cloud sync (Premium)',
	'settings.cloud.sectionDesc':
		'Sync habits across your devices. Everything stays local until you opt in below.',
	'settings.cloudEnabled.name': 'Enable cloud sync',
	'settings.cloudEnabled.desc':
		'Off = fully local, exactly as before. On = sync via your Firebase project (Premium plan required).',
	'settings.cloudUpsell.name': 'Premium required',
	'settings.cloudUpsell.desc':
		'Cloud sync is a Premium feature. Your habits stay fully local on the free plan.',
	'settings.cloudPrivacy.name': 'What is sent',
	'settings.cloudPrivacy.desc':
		'Only habit titles, check marks, timestamps, and streak aggregates leave this device — never your note contents, filenames, or vault paths.',
	'settings.cloudApiKey.name': 'Firebase API key',
	'settings.cloudApiKey.desc':
		'Web API key from the Firebase console (Project settings → Your apps). Stored only on this device.',
	'settings.cloudApiKey.emptyPlaceholder': 'Paste Firebase API key',
	'settings.cloudApiKey.savedPlaceholder': '•••••••• (key saved)',
	'settings.cloudAuthDomain.name': 'Auth domain',
	'settings.cloudAuthDomain.desc': 'From the same Firebase web config, e.g. my-app.firebaseapp.com.',
	'settings.cloudProjectId.name': 'Project ID',
	'settings.cloudProjectId.desc': 'From the same Firebase web config.',
	'settings.cloudAppId.name': 'App ID',
	'settings.cloudAppId.desc': 'From the same Firebase web config.',
	'settings.cloudStorageBucket.name': 'Storage bucket (optional)',
	'settings.cloudStorageBucket.desc': 'Optional. From the same Firebase web config.',
	'settings.cloudMessagingSenderId.name': 'Sender ID (optional)',
	'settings.cloudMessagingSenderId.desc': 'Optional. From the same Firebase web config.',
	'settings.cloudEmail.name': 'Account email',
	'settings.cloudEmail.desc': 'Email for Habitude cloud sign-in.',
	'settings.cloudEmail.placeholder': 'you@example.com',
	'settings.cloudPassword.name': 'Password',
	'settings.cloudPassword.desc': 'Used once to sign in; never stored.',
	'settings.cloudPassword.placeholder': 'Password',
	'settings.cloudSignIn': 'Sign in',
	'settings.cloudSignUp': 'Create account',
	'settings.cloudSignOut': 'Sign out',
	'settings.cloudGoogleSoon': 'Google sign-in (coming soon)',
	'settings.cloudSignedInAs': 'Signed in as {email}',
	'settings.cloudNotSignedIn': 'Not signed in',
	'settings.cloudStatus.name': 'Status',
	'settings.cloudStatus.disabled': 'Off — fully local',
	'settings.cloudStatus.needsConfig': 'On — finish the Firebase config below',
	'settings.cloudStatus.signedOut': 'Configured — sign in below',
	'settings.cloudStatus.notPremium': 'Signed in — Premium plan required for sync',
	'settings.cloudStatus.ready': 'Ready — syncing',
	'settings.cloudStatus.error': 'Error: {detail}',
	'settings.cloudSyncNow': 'Sync now',
	'settings.cloudConfigIncomplete': 'Complete the Firebase config first: {fields}.',
	'settings.cloudCredentialsRequired': 'Enter your account email and password first.',

	// Checklist view
	'checklist.weeklyReview': 'Weekly review',
	'checklist.newHabitPlaceholder': 'New habit… (enter to add)',
	'checklist.add': 'Add',
	'checklist.habitAdded': 'Habit added: {title}',
	'checklist.emptyTitle': 'No habits yet.',
	'checklist.emptyHint': 'Add your first habit above — e.g. "morning run".',
	'checklist.habitOptions': 'Habit options',
	'checklist.archiveHabit': 'Archive habit',
	'checklist.habitArchived': 'Habit archived: {title}',
	'checklist.saveCheckFailed': 'Could not save the check.',
	'checklist.progress': 'Progress',
	'checklist.shareProgress': '📤 Share progress',
	'checklist.shareNote':
		'Sharing runs only when you tap the button. Only aggregate stats — habit titles, streaks, completion rates — are sent; your note contents are never included.',
	'checklist.getCoaching': '✨ Get AI coaching',
	'checklist.footnote':
		'Your data stays in your vault as plain Markdown. Nothing leaves your device unless you explicitly share it.',
	'checklist.toggleAria': '{title} on {date}',

	// Coach view
	'coach.setupTitle': 'AI coach — bring your own key',
	'coach.setupDesc':
		'Pick an AI provider and chat with a coach that knows your habits — your streaks, weekly rates, and weak days are shared with the model automatically as statistics.',
	'coach.setupStep1Prefix': 'Get a free key at ',
	'coach.setupStep1Link': 'Google AI Studio',
	'coach.setupStep1Suffix': '.',
	'coach.setupStep2':
		'Paste it below. It stays on this device — it is only ever sent to Google, never to Habitude.',
	'coach.keyPlaceholder': 'Paste API key',
	'coach.saveKey': 'Save & start',
	'coach.pasteKeyFirst': 'Paste your API key first.',
	'coach.getKeyLink': 'Get a key',
	'coach.noKeyNeeded': 'No key needed — the selected provider runs locally on this device.',
	'coach.headerTitle': 'AI Coach',
	'coach.newChat': 'New chat',
	'coach.inputPlaceholder': 'Ask your coach…',
	'coach.send': 'Send',
	'coach.footnote': 'Your key and chats stay on this device. Requests go directly to {provider}.',
	'coach.removeKey': 'Remove key',
	'coach.addKeyFirst': 'Add your API key first.',
	'coach.thinking': 'Coach is thinking…',
	'coach.genericError': 'Something went wrong. Please try again.',
	'coach.fallbackGreeting': "Hi, I'm your Habitude Coach. What's on your mind?",

	// Weekly review modal
	'review.title': 'Weekly review',
	'review.empty': 'No habits yet. Add your first habit from the checklist view.',
	'review.totalChecks': 'Total checks this week: {total}',
	'review.perHabitMeta': '{rate}% · {checked}/{total} days · 🔥 {streak}',

	// Share
	'share.serverNotReady': 'Share server is not ready yet.',
	'share.linkCopied': 'Share link copied to clipboard.',
	'share.linkFallback': 'Share link: {url}',

	// User-visible coach errors
	'coach.error.rateLimit': 'Rate limit hit (free tier). Wait a minute and try again.',
	'coach.error.httpError': '{provider} returned an error (status {status}). Please try again.',
	'coach.error.network': 'Could not reach the AI provider. Check your connection. ({detail})',
	'coach.error.unreadable': 'Got an unreadable response from the model. Please try again.',
	'coach.error.authRejected':
		'That API key was rejected or lacks access. Double-check it in Settings → Habitude checklist.',
	'coach.error.authInvalid':
		'The API key is invalid or lacks access. Check it in Settings → Habitude checklist.',
	'coach.error.modelError': 'Model error: {detail}',
	'coach.error.emptyReply': 'The model returned an empty reply. Please try again.',
	'coach.error.baseUrlRequired':
		'Set a base URL for the custom provider in Settings → Habitude checklist.',
	'coach.error.modelRequired':
		'Set a model ID for the custom provider in Settings → Habitude checklist.',

	// Date labels
	'dates.weekRange': '{sm} {sd} – {em} {ed}',
};

const ko: Dict = {
	// Views & ribbon
	'view.checklist.title': 'Habitude 체크리스트',
	'view.coach.title': 'Habitude AI 코치',
	'ribbon.checklist': 'Habitude 체크리스트',
	'ribbon.coach': 'Habitude AI 코치',
	'notice.cannotOpenChecklist': '체크리스트 보기를 열 수 없습니다.',
	'notice.cannotOpenCoach': 'AI 코치를 열 수 없습니다.',
	'statusbar.today': '✓ 오늘 {done}/{total}',

	// Commands
	'cmd.openChecklist': '체크리스트 열기',
	'cmd.openCoach': 'AI 코치 열기',
	'cmd.openWeeklyReview': '주간 리뷰 열기',
	'cmd.toggleToday': '오늘 체크 토글',
	'cmd.pickHabitPlaceholder': '오늘 체크할 습관 선택…',
	'cmd.noHabitsYet': '습관이 아직 없습니다. 체크리스트에서 추가하세요.',
	'cmd.toggledChecked': '{title}: 오늘 완료로 표시됨',
	'cmd.toggledUnchecked': '{title}: 오늘 미완료로 표시됨',

	// Settings
	'settings.dataFolder.name': '데이터 폴더',
	'settings.dataFolder.desc': 'Habits.md와 일별 Log 노트가 저장되는 볼트 폴더.',
	'settings.dataFolder.placeholder': 'Habitude',
	'settings.weekStart.name': '주 시작 요일',
	'settings.weekStart.desc': '체크리스트 그리드에서 한 주의 시작 요일.',
	'settings.weekStart.monday': '월요일',
	'settings.weekStart.sunday': '일요일',
	'settings.checkmarkColor.name': '체크마크 색상',
	'settings.checkmarkColor.desc': '체크된 날짜의 ✓ 표시 색상. 변경하면 열린 체크리스트에 바로 반영됩니다.',
	'settings.provider.name': 'AI 제공자',
	'settings.provider.desc':
		'AI 코치가 대화할 LLM 서비스. 키와 대화 내용은 이 제공자에게만 전송되며 Habitude로는 절대 전송되지 않습니다.',
	'settings.provider.gemini': 'Google Gemini',
	'settings.provider.openai': 'OpenAI',
	'settings.provider.anthropic': 'Anthropic Claude',
	'settings.provider.openrouter': 'OpenRouter',
	'settings.provider.ollama': 'Ollama (로컬)',
	'settings.provider.lmstudio': 'LM Studio (로컬)',
	'settings.provider.custom': '사용자 지정 (OpenAI 호환)',
	'settings.llmKey.name': 'API 키 (AI 코치, 선택)',
	'settings.llmKey.desc':
		'선택한 AI 제공자의 본인 키. 이 기기에만 저장되며 해당 제공자에게만 전송되고 Habitude로는 절대 전송되지 않습니다.',
	'settings.llmKey.noKeyDesc': '키 불필요 — 선택한 제공자는 이 기기에서 직접 실행됩니다. 여기에 저장한 키는 무시됩니다.',
	'settings.llmKey.savedPlaceholder': '•••••••• (키 저장됨)',
	'settings.llmKey.emptyPlaceholder': 'AI 코치를 켜려면 키를 붙여넣으세요',
	'settings.llmModel.name': '코치 모델',
	'settings.llmModel.desc': 'AI 코치가 사용하는 모델 ID. 비워 두면 제공자 기본값을 사용합니다.',
	'settings.baseUrl.name': 'API Base URL',
	'settings.baseUrl.desc': '제공자 엔드포인트 재정의(선택). 비워 두면 제공자 기본값을 사용합니다.',
	'settings.baseUrl.requiredDesc': '사용자 지정 제공자는 필수 — OpenAI 호환 엔드포인트의 Base URL을 입력하세요.',
	'settings.baseUrl.placeholder': '기본값: {url}',
	'settings.coachLanguage.name': '코치 언어',
	'settings.coachLanguage.desc': 'AI 코치의 답변 언어.',
	'settings.coachLanguage.auto': '자동 (나와 맞춤)',
	'settings.coachLanguage.english': 'English',
	'settings.coachLanguage.korean': '한국어',
	'settings.sharing.name': '공유',
	'settings.sharing.desc':
		'공유하기는 사용자가 직접 누를 때만 동작하며, 전송되는 데이터는 습관 제목·스트릭·완료율 같은 집계 통계뿐이고 노트 내용은 포함되지 않습니다.',

	// 클라우드 동기화 (프리미엄, 옵트인)
	'cmd.syncNow': '지금 동기화 (클라우드)',
	'cmd.syncNowDisabled': '클라우드 동기화가 꺼져 있습니다. 설정 → Habitude checklist에서 켜세요.',
	'cmd.syncDone': '클라우드 동기화 완료: {pushed}건 전송, {pulled}건 수신.',
	'cmd.syncFailed': '클라우드 동기화 실패: {detail}',
	'settings.cloud.section': '클라우드 동기화 (프리미엄)',
	'settings.cloud.sectionDesc':
		'여러 기기에서 습관을 동기화합니다. 아래에서 직접 켜기 전까지는 모든 것이 로컬에만 있습니다.',
	'settings.cloudEnabled.name': '클라우드 동기화 켜기',
	'settings.cloudEnabled.desc':
		'끄기 = 기존과 동일한 완전 로컬 동작. 켜기 = Firebase 프로젝트로 동기화 (프리미엄 플랜 필요).',
	'settings.cloudUpsell.name': '프리미엄 필요',
	'settings.cloudUpsell.desc':
		'클라우드 동기화는 프리미엄 기능입니다. 무료 플랜에서는 습관이 완전히 로컬에만 저장됩니다.',
	'settings.cloudPrivacy.name': '전송되는 항목',
	'settings.cloudPrivacy.desc':
		'습관 이름, 체크 여부, 타임스탬프, 스트릭 집계만 이 기기를 벗어납니다 — 노트 내용, 파일명, 볼트 경로는 절대 전송되지 않습니다.',
	'settings.cloudApiKey.name': 'Firebase API 키',
	'settings.cloudApiKey.desc':
		'Firebase 콘솔의 웹 API 키 (프로젝트 설정 → 내 앱). 이 기기에만 저장됩니다.',
	'settings.cloudApiKey.emptyPlaceholder': 'Firebase API 키 붙여넣기',
	'settings.cloudApiKey.savedPlaceholder': '•••••••• (키 저장됨)',
	'settings.cloudAuthDomain.name': '인증 도메인',
	'settings.cloudAuthDomain.desc': '같은 Firebase 웹 설정에서 확인 (예: my-app.firebaseapp.com).',
	'settings.cloudProjectId.name': '프로젝트 ID',
	'settings.cloudProjectId.desc': '같은 Firebase 웹 설정에서 확인.',
	'settings.cloudAppId.name': '앱 ID',
	'settings.cloudAppId.desc': '같은 Firebase 웹 설정에서 확인.',
	'settings.cloudStorageBucket.name': '스토리지 버킷 (선택)',
	'settings.cloudStorageBucket.desc': '선택 사항. 같은 Firebase 웹 설정에서 확인.',
	'settings.cloudMessagingSenderId.name': '발신자 ID (선택)',
	'settings.cloudMessagingSenderId.desc': '선택 사항. 같은 Firebase 웹 설정에서 확인.',
	'settings.cloudEmail.name': '계정 이메일',
	'settings.cloudEmail.desc': 'Habitude 클라우드 로그인용 이메일.',
	'settings.cloudEmail.placeholder': 'you@example.com',
	'settings.cloudPassword.name': '비밀번호',
	'settings.cloudPassword.desc': '로그인할 때만 사용하고 저장하지 않습니다.',
	'settings.cloudPassword.placeholder': '비밀번호',
	'settings.cloudSignIn': '로그인',
	'settings.cloudSignUp': '계정 만들기',
	'settings.cloudSignOut': '로그아웃',
	'settings.cloudGoogleSoon': 'Google 로그인 (준비 중)',
	'settings.cloudSignedInAs': '{email}(으)로 로그인됨',
	'settings.cloudNotSignedIn': '로그인되지 않음',
	'settings.cloudStatus.name': '상태',
	'settings.cloudStatus.disabled': '꺼짐 — 완전 로컬',
	'settings.cloudStatus.needsConfig': '켜짐 — 아래 Firebase 설정을 완성하세요',
	'settings.cloudStatus.signedOut': '설정됨 — 아래에서 로그인하세요',
	'settings.cloudStatus.notPremium': '로그인됨 — 동기화에는 프리미엄 플랜이 필요합니다',
	'settings.cloudStatus.ready': '준비됨 — 동기화 중',
	'settings.cloudStatus.error': '오류: {detail}',
	'settings.cloudSyncNow': '지금 동기화',
	'settings.cloudConfigIncomplete': 'Firebase 설정을 먼저 완성하세요: {fields}.',
	'settings.cloudCredentialsRequired': '계정 이메일과 비밀번호를 먼저 입력하세요.',

	// Checklist view
	'checklist.weeklyReview': '주간 리뷰',
	'checklist.newHabitPlaceholder': '새 습관… (엔터로 추가)',
	'checklist.add': '추가',
	'checklist.habitAdded': '습관 추가됨: {title}',
	'checklist.emptyTitle': '습관이 아직 없습니다.',
	'checklist.emptyHint': '위에서 첫 습관을 추가하세요. 예: "아침 러닝".',
	'checklist.habitOptions': '습관 옵션',
	'checklist.archiveHabit': '습관 보관',
	'checklist.habitArchived': '습관 보관됨: {title}',
	'checklist.saveCheckFailed': '체크를 저장할 수 없습니다.',
	'checklist.progress': '진행 상황',
	'checklist.shareProgress': '📤 진행 상황 공유',
	'checklist.shareNote':
		'공유하기는 사용자가 직접 누를 때만 동작하며, 전송되는 데이터는 습관 제목·스트릭·완료율 같은 집계 통계뿐이고 노트 내용은 포함되지 않습니다.',
	'checklist.getCoaching': '✨ AI 코칭 받기',
	'checklist.footnote':
		'데이터는 볼트 안에 일반 Markdown으로 보관됩니다. 직접 공유하지 않는 한 기기 밖으로 나가지 않습니다.',
	'checklist.toggleAria': '{date}의 {title}',

	// Coach view
	'coach.setupTitle': 'AI 코치 — 본인 키로 사용',
	'coach.setupDesc':
		'AI 제공자를 선택하고 습관을 아는 코치와 대화하세요. 스트릭, 주간 완료율, 약한 요일 같은 통계가 모델에 자동으로 전달됩니다.',
	'coach.setupStep1Prefix': '',
	'coach.setupStep1Link': 'Google AI Studio',
	'coach.setupStep1Suffix': '에서 무료 키를 받으세요.',
	'coach.setupStep2':
		'아래에 붙여넣으세요. 이 기기에만 보관되며, Google에만 전송되고 Habitude로는 절대 전송되지 않습니다.',
	'coach.keyPlaceholder': 'API 키 붙여넣기',
	'coach.saveKey': '저장하고 시작',
	'coach.pasteKeyFirst': '먼저 API 키를 붙여넣으세요.',
	'coach.getKeyLink': '키 발급받기',
	'coach.noKeyNeeded': '키가 필요 없습니다 — 선택한 제공자는 이 기기에서 로컬로 실행됩니다.',
	'coach.headerTitle': 'AI 코치',
	'coach.newChat': '새 대화',
	'coach.inputPlaceholder': '코치에게 물어보세요…',
	'coach.send': '전송',
	'coach.footnote': '키와 대화 내용은 이 기기에만 보관됩니다. 요청은 {provider}(으)로 직접 전송됩니다.',
	'coach.removeKey': '키 삭제',
	'coach.addKeyFirst': '먼저 API 키를 추가하세요.',
	'coach.thinking': '코치가 생각 중…',
	'coach.genericError': '문제가 발생했습니다. 다시 시도하세요.',
	'coach.fallbackGreeting': '안녕하세요, Habitude 코치입니다. 무슨 고민이 있으세요?',

	// Weekly review modal
	'review.title': '주간 리뷰',
	'review.empty': '습관이 아직 없습니다. 체크리스트 보기에서 첫 습관을 추가하세요.',
	'review.totalChecks': '이번 주 총 체크: {total}',
	'review.perHabitMeta': '{rate}% · {checked}/{total}일 · 🔥 {streak}',

	// Share
	'share.serverNotReady': '공유 서버 준비 중',
	'share.linkCopied': '공유 링크가 클립보드에 복사되었습니다.',
	'share.linkFallback': '공유 링크: {url}',

	// User-visible coach errors
	'coach.error.rateLimit': '요청 한도에 도달했습니다(무료 등급). 1분 후 다시 시도하세요.',
	'coach.error.httpError': '{provider}에서 오류가 발생했습니다(상태 {status}). 다시 시도하세요.',
	'coach.error.network': 'AI 제공자에 연결할 수 없습니다. 연결을 확인하세요. ({detail})',
	'coach.error.unreadable': '모델 응답을 읽을 수 없습니다. 다시 시도하세요.',
	'coach.error.authRejected':
		'이 API 키가 거부되었거나 접근 권한이 없습니다. 설정 → Habitude checklist에서 확인하세요.',
	'coach.error.authInvalid':
		'API 키가 유효하지 않거나 접근 권한이 없습니다. 설정 → Habitude checklist에서 확인하세요.',
	'coach.error.modelError': '모델 오류: {detail}',
	'coach.error.emptyReply': '모델이 빈 응답을 반환했습니다. 다시 시도하세요.',
	'coach.error.baseUrlRequired': '설정 → Habitude checklist에서 사용자 지정 제공자의 Base URL을 입력하세요.',
	'coach.error.modelRequired': '설정 → Habitude checklist에서 사용자 지정 제공자의 모델 ID를 입력하세요.',

	// Date labels
	'dates.weekRange': '{sm} {sd}일 – {em} {ed}일',
};

/** Raw dictionaries, exported for tests and tooling (parity checks, etc.). */
export const UI_STRINGS: Record<UiLocale, Dict> = { en, ko };

/** Test/dev override. Takes precedence over auto-detection until cleared. */
let override: UiLocale | null = null;

export function setUiLocale(locale: UiLocale): void {
	override = locale;
}

export function clearUiLocale(): void {
	override = null;
}

/**
 * Detect the UI locale from Obsidian's own language setting via the
 * getLanguage() API. Never throws: the API may be absent (node tests)
 * or access-restricted. Uses window for popout window compatibility
 * per the community review guidelines.
 */
export function getUiLocale(): UiLocale {
	if (override) return override;
	try {
		// getLanguage() is exposed on window by the Obsidian runtime.
		const w =
			typeof window === 'undefined'
				? undefined
				: (window as unknown as { getLanguage?: unknown });
		const getLang = w?.getLanguage;
		if (typeof getLang === 'function') {
			const lang = (getLang as () => string)();
			if (lang && lang.toLowerCase().startsWith('ko')) return 'ko';
		}
	} catch {
		// Absent or unreadable — fall through to English.
	}
	return 'en';
}

/**
 * Translate a key for the current UI locale. Falls back to English, then to
 * the key itself. Supports {name} interpolation via `vars`.
 */
export function t(key: string, vars?: Record<string, string | number>): string {
	const locale = getUiLocale();
	let s = UI_STRINGS[locale][key] ?? UI_STRINGS.en[key] ?? key;
	if (vars) {
		for (const [k, v] of Object.entries(vars)) {
			s = s.split(`{${k}}`).join(String(v));
		}
	}
	return s;
}
