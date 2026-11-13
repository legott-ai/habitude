// UI localization (en/ko) for plugin chrome: views, commands, settings,
// notices, and user-visible error strings.
//
// Scope: plugin UI only. The AI coach's *reply* language is a separate user
// setting ("Coach language" in settings) and is untouched by this module.
// The locale is detected from Obsidian's own UI language setting; there is
// no per-plugin language switch.

import { getLanguage } from 'obsidian';

export type UiLocale = 'en' | 'ko';

type Dict = Record<string, string>;

const en: Dict = {
	"transfer.command": "Export habits for Habitude",
	"transfer.title": "Move your habits to Habitude",
	"transfer.settingsDesc": "Preview a local JSON copy of habits and check history. Your original Markdown stays here. No upload or account required.",
	"transfer.preview": "Preview export",
	"transfer.loading": "Reading habit records…",
	"transfer.local": "This creates a JSON file in your vault. Nothing is uploaded.",
	"transfer.summary": "{habits} habits ({archived} archived) · {checks} recorded states ({checked} completed)",
	"transfer.range": "Recorded dates: {start} – {end}",
	"transfer.scope": "Includes habit names, IDs, creation dates, archive status and daily check states. Excludes API keys, chats, note text and other vault files. Keep the export private.",
	"transfer.importHelp": "In a Habitude build with this feature, select Settings → Import from Obsidian and choose the JSON file. This is a manual copy; later changes do not sync automatically.",
	"transfer.save": "Save JSON in vault",
	"transfer.cancel": "Cancel",
	"transfer.saved": "Saved local export: {path}",
	"transfer.error.folder": "Choose a valid vault-relative Habitude data folder.",
	"transfer.error.registry": "Habit data is missing or malformed. Check Habits.md and the checkbox format in daily logs, then try again.",
	"transfer.error.date": "A habit or log has an invalid calendar date. Fix the date before exporting.",
	"transfer.error.duplicate": "Duplicate habit IDs or daily check states were found. Resolve them in your Markdown files before exporting.",
	"transfer.error.unknownHabit": "A log refers to a habit missing from Habits.md. Restore the habit registry entry before exporting.",
	"transfer.error.limit": "This export exceeds the supported limit: 10 MiB, 5,000 habits or 100,000 check states.",
	"transfer.error.changed": "Habit files changed while preparing the export. Close this preview and try again.",
	"transfer.error.read": "Could not read your habit files. Your originals have not been changed.",
	"transfer.error.save": "Could not save the export. Your original habit records have not been changed.",

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
	'cmd.exploreHabitude': 'Explore Habitude on the web',
	'cmd.toggleToday': 'Toggle today for a habit',
	'cmd.pickHabitPlaceholder': 'Pick a habit to toggle for today…',
	'cmd.noHabitsYet': 'No habits yet. Open the checklist to add one.',
	'cmd.toggledChecked': '{title}: checked for today',
	'cmd.toggledUnchecked': '{title}: unchecked for today',

	// Settings
	'settings.dataFolder.name': 'Data folder',
	'settings.dataFolder.desc': 'Vault folder for Habits.md and daily Log notes.',
	'settings.dataFolder.placeholder': 'Habitude',
	'settings.dataFolder.invalid':
		'Data folder must be a relative vault path without .. or illegal characters.',
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
		'Your own provider key. Stored in vault plugin settings, which backups or sync may include. Sent only to your selected provider, never to Habitude.',
	'settings.llmKey.noKeyDesc':
		'No key needed — the selected provider runs on your own machine. Any key saved here is ignored.',
	'settings.llmKey.savedPlaceholder': '•••••••• (key saved)',
	'settings.llmKey.emptyPlaceholder': 'Paste key to enable the AI coach',
	'settings.llmModel.name': 'Coach model',
	'settings.llmModel.desc': 'Model ID used by the AI coach. Empty uses the provider default.',
	'settings.llmModel.invalid':
		'Model ID cannot exceed 200 characters or contain control characters.',
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
	'settings.companionPrompts.name': 'Show Habitude suggestions',
	'settings.companionPrompts.desc': 'Show dismissible suggestions in the checklist, weekly review, and coach. No tracking or network requests.',
	'settings.companionExplore.name': 'Habitude on the web',
	'settings.companionExplore.desc': 'Explore the separate web product and preview planned Sync and Plus options. Opens a local overview first.',
	'settings.companionExplore.button': 'Explore Habitude',

	// Habitude companion overview (local; outbound navigation is explicit)
	'companion.card.restart.title': 'Your {days}-day run of {title} paused',
	'companion.card.restart.body': 'How did you get going again last time? Habitude is being built to answer that from your own notes.',
	'companion.card.review.title': 'After the numbers comes "why"',
	'companion.card.review.body': 'Why a week went well or badly is in what you wrote. Habitude is being built to answer that from your own notes.',
	'companion.card.coach.title': 'Want answers from your notes, not only your stats?',
	'companion.card.coach.body': 'This coach sees your habit statistics. In the Habitude app, Habi is being built to answer on your Mac from your own notes. A link to the AI you already use is planned too.',
	'companion.card.explore': 'See what Habitude does',
	'companion.card.dismiss': 'Hide app suggestions',
	'companion.card.dismissAria': 'Hide all app suggestions. Restore them in Habitude settings.',
	'companion.savePreferenceFailed': 'Could not save this preference. Please try again.',
	'companion.title': 'Habitude: talk with your own records',
	'companion.intro': 'Keep checking off habits here. When you start asking why, Habitude picks up from there.',
	'companion.does.title': 'What Habitude does',
	'companion.does.web.title': 'Journal and habits together',
	'companion.does.web.body': 'Write on the web and see your habits beside your days.',
	'companion.does.habi.title': 'Habi: you, answering from your records',
	'companion.does.habi.body': 'Ask "how did I get going again last time?" and Habi looks through your vault and journal. Being built for the Mac and iPad apps, where it runs on the device.',
	'companion.does.agent.title': 'A link to the AI you already use',
	'companion.does.agent.body': 'Lets an AI such as Claude or ChatGPT look up only the records a question needs. When you use it, those excerpts go to the AI provider you chose.',
	'companion.current.title': 'Your plugin stays free',
	'companion.current.body': 'Checklists, streaks, graphs, weekly reviews, and coaching with your own provider remain available. AI provider usage may have its own costs.',
	'companion.plans.title': 'Preview planned options',
	'companion.plans.status': 'Sync and Plus are in preparation. Neither plan can be purchased or connected from this plugin.',
	'companion.billing.label': 'Preview billing period',
	'companion.billing.monthly': 'Monthly',
	'companion.billing.annual': 'Annual',
	'companion.plan.available': 'Available here',
	'companion.plan.planned': 'Planned',
	'companion.plan.free.local': 'Markdown habit records in your vault',
	'companion.plan.free.review': 'Checklists, graphs, and weekly reviews',
	'companion.plan.free.coach': 'Coaching with your own AI provider',
	'companion.plan.storage': '{amount} GiB of storage',
	'companion.plan.sync': 'Cloud sync for the Habitude app',
	'companion.plan.analysis': 'AI assistance and advanced analysis',
	'companion.plan.sources': 'Up to {count} connected sources',
	'companion.plan.credits': '{count} weighted AI credits each month',
	'companion.plan.noCredits': 'No included AI credits',
	'companion.plan.free.note': 'No Habitude account required.',
	'companion.plan.plannedNote': 'Planned features · not on sale',
	'companion.price.free': 'Free plugin',
	'companion.price.monthly': 'Planned total per month',
	'companion.price.annual': 'Planned total per year',
	'companion.plans.note': 'Launch prices in USD. 200 weighted credits does not mean 200 messages. Credit costs, taxes, supported sources, and billing terms will be disclosed before purchase.',
	'companion.privacy.title': 'Before you visit',
	'companion.privacy.data': 'Your Obsidian habits and history are not automatically imported or synced. Visiting the website does not send habit records, notes, chats, or API keys.',
	'companion.privacy.website': 'Habitude on the web is a separate product. Opening the link sends only the page address and a fixed campaign source to your browser; the website has its own privacy and billing terms.',
	'companion.privacy.serviceStatus': 'Sync and Plus are in preparation and are not on sale. Manual habit transfer is free and does not enable automatic sync.',
	'companion.explore': 'Visit Habitude website',
	'companion.close': 'Keep using Obsidian',
	'companion.externalHint': 'Opens in your browser.',

	// Checklist view
	'checklist.weeklyReview': 'Weekly review',
	'checklist.newHabitPlaceholder': 'New habit… (enter to add)',
	'checklist.add': 'Add',
	'checklist.habitAdded': 'Habit added: {title}',
	'checklist.emptyTitle': 'Pick your first habit',
	'checklist.emptyHint': 'Tap one to start, or type your own above. It is saved as Markdown in your vault.',
	'checklist.starterAria': 'Add habit: {title}',
	'checklist.thisWeek': 'This week',
	'checklist.today.count': 'Today: {done} of {total} done',
	'checklist.today.ask': 'Did you do "{title}" today?',
	'checklist.today.done': 'Done',
	'checklist.today.allDone': 'All done for today.',
	'checklist.habitOptions': 'Habit options',
	'checklist.archiveHabit': 'Archive habit',
	'checklist.habitArchived': 'Habit archived: {title}',
	'checklist.addHabitFailed': 'Could not add the habit.',
	'checklist.archiveHabitFailed': 'Could not archive the habit.',
	'checklist.saveCheckFailed': 'Could not save the check.',
	'checklist.progress': 'Progress',
	'checklist.shareProgress': '📤 Share progress',
	'checklist.shareNote':
		'Sharing runs only when you tap the button. Only aggregate stats — habit titles, streaks, completion rates — are sent; your note contents are never included.',
	'checklist.footnote':
		'Tracking stays in your vault as Markdown. Sharing and AI coaching send data only when you use them.',
	'checklist.toggleAria': '{title} on {date}',

	// Coach view
	'coach.setupTitle': 'AI coach',
	'coach.setupDesc':
		'Pick an AI provider and chat with a coach that knows your habits — your streaks, weekly rates, and weak days are shared with the model automatically as statistics.',
	'coach.setupNeedsBaseUrl':
		'Enter the base URL for your custom OpenAI-compatible endpoint.',
	'coach.setupNeedsModel':
		'Enter the model ID to request from your custom endpoint.',
	'coach.keyPlaceholder': 'Paste API key',
	'coach.saveKey': 'Save & start',
	'coach.pasteKeyFirst': 'Paste your API key first.',
	'coach.getKeyLink': 'Get a key',
	'coach.noKeyNeeded': 'No key needed — the selected provider runs locally on this device.',
	'coach.headerTitle': 'AI Coach',
	'coach.newChat': 'New chat',
	'coach.inputPlaceholder': 'Ask your coach…',
	'coach.send': 'Send',
	'coach.footnote': 'Requests go directly to {provider}. Keys are saved in vault plugin settings.',
	'coach.removeKey': 'Remove key',
	'coach.addKeyFirst': 'Add your API key first.',
	'coach.thinking': 'Coach is thinking…',
	'coach.genericError': 'Something went wrong. Please try again.',
	'coach.fallbackGreeting': "Hi, I'm your Habitude Coach. What's on your mind?",
	'coach.local.title': 'Use a model on this computer',
	'coach.local.desc':
		'No API key needed. Works with Ollama or LM Studio running on this computer, so your habit statistics and messages stay on it.',
	'coach.local.find': 'Find local models',
	'coach.local.finding': 'Looking…',
	'coach.local.none': 'No local model found.',
	'coach.local.howto':
		'Install Ollama or LM Studio, download a chat model, keep it running, then try again.',
	'coach.local.useAria': 'Start the coach with {name}',
	'coach.byok.title': 'Or connect a provider with your own API key',

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
	'coach.error.baseUrlInvalid':
		'Enter a valid base URL using https:// (or http:// for localhost).',
	'coach.error.modelRequired':
		'Set a model ID for the custom provider in Settings → Habitude checklist.',

	// Date labels
	'dates.weekRange': '{sm} {sd} – {em} {ed}',
};

const ko: Dict = {
	"transfer.command": "Habitude용 습관 내보내기",
	"transfer.title": "Habitude로 습관 옮기기",
	"transfer.settingsDesc": "습관과 체크 기록을 로컬 JSON으로 복사하기 전에 확인합니다. 원본 Markdown은 유지하며 업로드·계정 연결은 하지 않습니다.",
	"transfer.preview": "내보내기 미리 보기",
	"transfer.loading": "습관 기록을 읽고 있습니다…",
	"transfer.local": "볼트 안에 JSON 파일을 만듭니다. 외부로 업로드하지 않습니다.",
	"transfer.summary": "습관 {habits}개(보관 {archived}개) · 기록 상태 {checks}개(완료 {checked}개)",
	"transfer.range": "기록 기간: {start} – {end}",
	"transfer.scope": "습관명·ID·생성일·보관 상태·일별 체크 상태를 포함합니다. API 키·대화·노트 본문·다른 볼트 파일은 제외합니다. 내보낸 파일은 비공개로 보관하세요.",
	"transfer.importHelp": "이 기능이 있는 Habitude 빌드에서 설정 → Obsidian에서 가져오기를 선택한 뒤 JSON 파일을 고르세요. 수동 복사이므로 이후 변경은 자동 동기화하지 않습니다.",
	"transfer.save": "볼트에 JSON 저장",
	"transfer.cancel": "취소",
	"transfer.saved": "로컬 내보내기 저장됨: {path}",
	"transfer.error.folder": "볼트 안의 올바른 Habitude 데이터 폴더를 선택하세요.",
	"transfer.error.registry": "습관 데이터가 없거나 형식이 올바르지 않습니다. Habits.md와 일별 로그의 체크 형식을 확인한 뒤 다시 시도하세요.",
	"transfer.error.date": "습관이나 로그의 날짜가 올바르지 않습니다. 내보내기 전에 달력 날짜를 수정하세요.",
	"transfer.error.duplicate": "중복 습관 ID 또는 같은 날의 중복 체크 상태가 있습니다. Markdown 원본에서 정리한 뒤 내보내세요.",
	"transfer.error.unknownHabit": "로그에 Habits.md에 없는 습관이 있습니다. 습관 등록 정보를 복원한 뒤 내보내세요.",
	"transfer.error.limit": "지원 한도(10 MiB·습관 5,000개·체크 상태 100,000개)를 넘었습니다.",
	"transfer.error.changed": "미리 보기를 준비하는 동안 습관 파일이 바뀌었습니다. 닫은 뒤 다시 시도하세요.",
	"transfer.error.read": "습관 파일을 읽지 못했습니다. 원본은 변경하지 않았습니다.",
	"transfer.error.save": "내보내기 파일을 저장하지 못했습니다. 원본 습관 기록은 변경하지 않았습니다.",

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
	'cmd.exploreHabitude': 'Habitude 웹 둘러보기',
	'cmd.toggleToday': '오늘 체크 토글',
	'cmd.pickHabitPlaceholder': '오늘 체크할 습관 선택…',
	'cmd.noHabitsYet': '습관이 아직 없습니다. 체크리스트에서 추가하세요.',
	'cmd.toggledChecked': '{title}: 오늘 완료로 표시됨',
	'cmd.toggledUnchecked': '{title}: 오늘 미완료로 표시됨',

	// Settings
	'settings.dataFolder.name': '데이터 폴더',
	'settings.dataFolder.desc': 'Habits.md와 일별 Log 노트가 저장되는 볼트 폴더.',
	'settings.dataFolder.placeholder': 'Habitude',
	'settings.dataFolder.invalid':
		'데이터 폴더는 ..이나 사용할 수 없는 문자가 없는 볼트 상대 경로여야 합니다.',
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
		'본인 AI 제공자 키. 볼트의 플러그인 설정에 저장되어 백업·동기화에 포함될 수 있습니다. 선택한 제공자에게만 전송하며 Habitude로는 보내지 않습니다.',
	'settings.llmKey.noKeyDesc': '키 불필요 — 선택한 제공자는 이 기기에서 직접 실행됩니다. 여기에 저장한 키는 무시됩니다.',
	'settings.llmKey.savedPlaceholder': '•••••••• (키 저장됨)',
	'settings.llmKey.emptyPlaceholder': 'AI 코치를 켜려면 키를 붙여넣으세요',
	'settings.llmModel.name': '코치 모델',
	'settings.llmModel.desc': 'AI 코치가 사용하는 모델 ID. 비워 두면 제공자 기본값을 사용합니다.',
	'settings.llmModel.invalid':
		'모델 ID는 200자를 넘거나 제어 문자를 포함할 수 없습니다.',
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
	'settings.companionPrompts.name': 'Habitude 제안 표시',
	'settings.companionPrompts.desc': '체크리스트, 주간 리뷰, 코치에 숨길 수 있는 제안을 표시합니다. 추적하거나 네트워크 요청을 보내지 않습니다.',
	'settings.companionExplore.name': 'Habitude 웹',
	'settings.companionExplore.desc': '별도 웹 제품을 둘러보고 준비 중인 Sync와 Plus를 확인하세요. 먼저 플러그인 안에서 안내를 표시합니다.',
	'settings.companionExplore.button': 'Habitude 둘러보기',

	// Habitude companion overview (local; outbound navigation is explicit)
	'companion.card.restart.title': '{days}일 이어지던 {title}, 잠시 멈췄어요',
	'companion.card.restart.body': '지난번엔 어떻게 다시 시작했을까요? Habitude는 이런 질문에 내 기록으로 답하도록 만들고 있습니다.',
	'companion.card.review.title': '숫자 다음은 "왜"입니다',
	'companion.card.review.body': '잘 된 주와 안 된 주의 이유는 내가 쓴 글 속에 있습니다. Habitude는 그 질문에 내 기록으로 답하도록 만들고 있습니다.',
	'companion.card.coach.title': '통계 말고 내 기록으로 답을 듣고 싶다면',
	'companion.card.coach.body': '이 코치는 습관 통계만 봅니다. Habitude 앱의 하비는 Mac 안에서 내 기록으로 답하도록 만들고 있습니다. 이미 쓰는 AI와 잇는 연결도 준비 중입니다.',
	'companion.card.explore': 'Habitude가 하는 일 보기',
	'companion.card.dismiss': '앱 안내 모두 숨기기',
	'companion.card.dismissAria': '앱 안내를 모두 숨깁니다. Habitude 설정에서 다시 켤 수 있습니다.',
	'companion.savePreferenceFailed': '안내 설정을 저장하지 못했습니다. 다시 시도하세요.',
	'companion.title': '내 기록과 대화하는 Habitude',
	'companion.intro': '체크는 여기서 계속하세요. "왜"가 궁금해질 때 Habitude가 이어받습니다.',
	'companion.does.title': 'Habitude가 하는 일',
	'companion.does.web.title': '일기와 습관을 한곳에서',
	'companion.does.web.body': '웹에서 일기를 쓰고, 습관을 그날의 기록 옆에서 봅니다.',
	'companion.does.habi.title': '하비: 내 기록으로 답하는 나',
	'companion.does.habi.body': '"지난번엔 어떻게 다시 시작했지?"라고 물으면 내 볼트와 일기에서 찾아 답합니다. Mac·iPad 앱에서 기기 안에서 동작하도록 만들고 있습니다.',
	'companion.does.agent.title': '쓰던 AI와 잇기',
	'companion.does.agent.body': 'Claude, ChatGPT 같은 AI가 질문에 필요한 기록만 찾아보게 합니다. 사용하면 그 발췌가 내가 고른 AI 제공자에게 전송됩니다.',
	'companion.current.title': '플러그인은 계속 무료입니다',
	'companion.current.body': '체크리스트, 스트릭, 그래프, 주간 리뷰, 본인 AI 제공자를 사용하는 코칭을 계속 이용할 수 있습니다. AI 제공자 사용료는 별도로 발생할 수 있습니다.',
	'companion.plans.title': '준비 중인 요금제 미리 보기',
	'companion.plans.status': 'Sync와 Plus는 준비 중입니다. 현재 플러그인에서 구매하거나 연결할 수 없습니다.',
	'companion.billing.label': '결제 주기 미리 보기',
	'companion.billing.monthly': '월간',
	'companion.billing.annual': '연간',
	'companion.plan.available': '현재 사용 가능',
	'companion.plan.planned': '준비 중',
	'companion.plan.free.local': '볼트에 Markdown으로 습관 기록',
	'companion.plan.free.review': '체크리스트, 그래프, 주간 리뷰',
	'companion.plan.free.coach': '본인 AI 제공자를 사용하는 코칭',
	'companion.plan.storage': '저장 공간 {amount} GiB',
	'companion.plan.sync': 'Habitude 앱의 클라우드 동기화',
	'companion.plan.analysis': 'AI 지원과 고급 분석',
	'companion.plan.sources': '연결 소스 최대 {count}개',
	'companion.plan.credits': '매월 가중 AI 크레딧 {count}개',
	'companion.plan.noCredits': '포함된 AI 크레딧 없음',
	'companion.plan.free.note': 'Habitude 계정 없이 사용할 수 있습니다.',
	'companion.plan.plannedNote': '예정된 기능 · 판매 전',
	'companion.price.free': '무료 플러그인',
	'companion.price.monthly': '예정된 월 결제 총액',
	'companion.price.annual': '예정된 연 결제 총액',
	'companion.plans.note': 'USD 기준 출시 예정 가격입니다. 가중 크레딧 200개는 메시지 200회를 뜻하지 않습니다. 차감 기준, 세금, 지원 소스와 결제 조건은 판매 전에 안내합니다.',
	'companion.privacy.title': '방문 전 확인하세요',
	'companion.privacy.data': 'Obsidian의 습관과 기록은 자동으로 가져오거나 동기화하지 않습니다. 웹 방문 시 습관 기록, 노트, 대화, API 키를 보내지 않습니다.',
	'companion.privacy.website': 'Habitude 웹은 별도 제품입니다. 링크를 열면 페이지 주소와 고정된 유입 출처만 브라우저로 전달되며, 웹사이트에는 자체 개인정보 및 결제 약관이 적용됩니다.',
	'companion.privacy.serviceStatus': 'Sync·Plus는 출시 준비 중이며 아직 판매하지 않습니다. 수동 습관 이전은 무료이며 자동 동기화를 켜지 않습니다.',
	'companion.explore': 'Habitude 웹사이트 방문',
	'companion.close': 'Obsidian에서 계속하기',
	'companion.externalHint': '브라우저에서 열립니다.',

	// Checklist view
	'checklist.weeklyReview': '주간 리뷰',
	'checklist.newHabitPlaceholder': '새 습관… (엔터로 추가)',
	'checklist.add': '추가',
	'checklist.habitAdded': '습관 추가됨: {title}',
	'checklist.emptyTitle': '첫 습관을 정해 보세요',
	'checklist.emptyHint': '하나를 눌러 시작하거나, 위에 직접 입력하세요. 볼트 안에 Markdown으로 저장됩니다.',
	'checklist.starterAria': '습관 추가: {title}',
	'checklist.thisWeek': '이번 주',
	'checklist.today.count': '오늘 {total}개 중 {done}개 완료',
	'checklist.today.ask': '오늘 {title}{particle} 했나요?',
	'checklist.today.done': '했어요',
	'checklist.today.allDone': '오늘 습관을 모두 했어요.',
	'checklist.habitOptions': '습관 옵션',
	'checklist.archiveHabit': '습관 보관',
	'checklist.habitArchived': '습관 보관됨: {title}',
	'checklist.addHabitFailed': '습관을 추가할 수 없습니다.',
	'checklist.archiveHabitFailed': '습관을 보관할 수 없습니다.',
	'checklist.saveCheckFailed': '체크를 저장할 수 없습니다.',
	'checklist.progress': '진행 상황',
	'checklist.shareProgress': '📤 진행 상황 공유',
	'checklist.shareNote':
		'공유하기는 사용자가 직접 누를 때만 동작하며, 전송되는 데이터는 습관 제목·스트릭·완료율 같은 집계 통계뿐이고 노트 내용은 포함되지 않습니다.',
	'checklist.footnote':
		'습관 기록은 볼트 안에 Markdown으로 보관됩니다. 공유와 AI 코칭은 직접 사용할 때만 데이터를 전송합니다.',
	'checklist.toggleAria': '{date}의 {title}',

	// Coach view
	'coach.setupTitle': 'AI 코치',
	'coach.setupDesc':
		'AI 제공자를 선택하고 습관을 아는 코치와 대화하세요. 스트릭, 주간 완료율, 약한 요일 같은 통계가 모델에 자동으로 전달됩니다.',
	'coach.setupNeedsBaseUrl': '사용자 지정 OpenAI 호환 엔드포인트의 Base URL을 입력하세요.',
	'coach.setupNeedsModel': '사용자 지정 엔드포인트에 요청할 모델 ID를 입력하세요.',
	'coach.keyPlaceholder': 'API 키 붙여넣기',
	'coach.saveKey': '저장하고 시작',
	'coach.pasteKeyFirst': '먼저 API 키를 붙여넣으세요.',
	'coach.getKeyLink': '키 발급받기',
	'coach.noKeyNeeded': '키가 필요 없습니다 — 선택한 제공자는 이 기기에서 로컬로 실행됩니다.',
	'coach.headerTitle': 'AI 코치',
	'coach.newChat': '새 대화',
	'coach.inputPlaceholder': '코치에게 물어보세요…',
	'coach.send': '전송',
	'coach.footnote': '요청은 {provider}(으)로 직접 전송합니다. 키는 볼트의 플러그인 설정에 저장합니다.',
	'coach.removeKey': '키 삭제',
	'coach.addKeyFirst': '먼저 API 키를 추가하세요.',
	'coach.thinking': '코치가 생각 중…',
	'coach.genericError': '문제가 발생했습니다. 다시 시도하세요.',
	'coach.fallbackGreeting': '안녕하세요, Habitude 코치입니다. 무슨 고민이 있으세요?',
	'coach.local.title': '이 컴퓨터의 모델 사용',
	'coach.local.desc':
		'API 키가 필요 없습니다. 이 컴퓨터에서 실행 중인 Ollama나 LM Studio를 쓰므로, 습관 통계와 대화가 이 컴퓨터 밖으로 나가지 않습니다.',
	'coach.local.find': '로컬 모델 찾기',
	'coach.local.finding': '찾는 중…',
	'coach.local.none': '로컬 모델을 찾지 못했습니다.',
	'coach.local.howto': 'Ollama나 LM Studio를 설치하고 대화용 모델을 받은 뒤, 실행해 둔 상태에서 다시 시도하세요.',
	'coach.local.useAria': '{name}(으)로 코치 시작',
	'coach.byok.title': '또는 본인 API 키로 연결',

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
	'coach.error.baseUrlInvalid': 'https://(로컬은 http:// 가능)로 시작하는 올바른 Base URL을 입력하세요.',
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
 * exported getLanguage() API, which also works in popout windows.
 * An unavailable or failing API falls back to English.
 */
export function getUiLocale(): UiLocale {
	if (override) return override;
	try {
		const lang = getLanguage();
		if (typeof lang === 'string' && lang.toLowerCase().startsWith('ko')) return 'ko';
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
