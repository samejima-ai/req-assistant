/**
 * ApiKeyPanel
 *
 * 責務: AIモデルとAPIキーの設定・保存UI（マルチプロバイダー対応）
 * 
 * - APIキー設定 (Google, OpenAI, Anthropic)
 * - フェーズ別モデル選択 (インテント, 設計図, ドキュメント, レビュー)
 */
import { useState } from 'react';
import { setApiKey, getApiKey, getPhaseModel, setPhaseModel } from '../services/configService.js';
import { MODEL_LIST, PHASES, PROVIDERS } from '../services/llmConfig.js';
import { callLLM } from '../services/llmService.js';

const SpinnerIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
    <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
  </svg>
);

const CheckCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
    <polyline points="22 4 12 14.01 9 11.01"></polyline>
  </svg>
);

const AlertTriangleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
    <line x1="12" y1="9" x2="12" y2="13"></line>
    <line x1="12" y1="17" x2="12.01" y2="17"></line>
  </svg>
);

const InfoIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="16" x2="12" y2="12"></line>
    <line x1="12" y1="8" x2="12.01" y2="8"></line>
  </svg>
);

export default function ApiKeyPanel({ onClose, onConfigSaved, embedded = false }) {
  const [activeTab, setActiveTab] = useState('models'); // 'models' or 'keys'
  
  // States for API Keys
  const [keys, setKeys] = useState({
    google: getApiKey(PROVIDERS.GOOGLE),
    openai: getApiKey(PROVIDERS.OPENAI),
    anthropic: getApiKey(PROVIDERS.ANTHROPIC),
  });

  // States for Phase Models
  const [phaseModels, setPhaseModels] = useState({
    intent: getPhaseModel(PHASES.INTENT.id) || MODEL_LIST.find(m => m.isDefault).id,
    extract: getPhaseModel(PHASES.EXTRACT.id) || MODEL_LIST.find(m => m.isDefault).id,
    doc: getPhaseModel(PHASES.DOC.id) || MODEL_LIST.find(m => m.isDefault).id,
    review: getPhaseModel(PHASES.REVIEW.id) || MODEL_LIST.find(m => m.isDefault).id,
  });

  const [persist, setPersist] = useState(true);
  const [isTesting, setIsTesting] = useState(null); // providerId | null
  const [testResult, setTestResult] = useState({}); // { providerId: 'success' | 'error' }

  const handleTestConnection = async (providerId) => {
    const key = keys[providerId];
    if (!key) return;

    setIsTesting(providerId);
    setTestResult(prev => ({ ...prev, [providerId]: null }));

    try {
      // 一時的にキーを設定してテスト
      const originalKey = getApiKey(providerId);
      setApiKey(providerId, key, false);

      const result = await callLLM({
        phaseId: PHASES.INTENT.id,
        userMessage: 'connection test. reply with "ok"',
        options: { maxTokens: 10 }
      });

      if (result.ok) {
        setTestResult(prev => ({ ...prev, [providerId]: 'success' }));
      } else {
        throw new Error(result.message);
      }
      
      // 元に戻す (保存はhandleSaveで行う)
      setApiKey(providerId, originalKey, false);
    } catch (e) {
      console.error(`API Test failed for ${providerId}:`, e);
      setTestResult(prev => ({ ...prev, [providerId]: 'error' }));
    } finally {
      setIsTesting(null);
    }
  };

  const handleSave = () => {
    // API Keys の保存
    Object.entries(keys).forEach(([provider, value]) => {
      setApiKey(provider, value, persist);
    });

    // Phase Models の保存
    Object.entries(phaseModels).forEach(([phase, modelId]) => {
      setPhaseModel(phase, modelId);
    });

    onConfigSaved?.();
    onClose?.();
  };

  return (
    <div className="flex flex-col h-full max-h-[80vh]">
      {/* タブ切り替え */}
      <div className="flex border-b border-gray-100 bg-gray-50/50">
        <button
          onClick={() => setActiveTab('models')}
          className={`flex-1 py-3 text-sm font-bold transition-all ${activeTab === 'models' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-gray-500 hover:text-gray-700'}`}
        >
          AIモデル設定
        </button>
        <button
          onClick={() => setActiveTab('keys')}
          className={`flex-1 py-3 text-sm font-bold transition-all ${activeTab === 'keys' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-gray-500 hover:text-gray-700'}`}
        >
          API キー
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {activeTab === 'models' ? (
          <div className="p-6 space-y-8">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-800 leading-relaxed">
              <p className="font-bold flex items-center gap-1.5 mb-1 text-blue-900">
                <InfoIcon /> モデルの選び方ガイド
              </p>
              処理の目的に合わせて最適なAIを使い分けることで、より正確な設計図を作成できます。
              <span className="font-bold">「思考型」</span>は少し時間がかかりますが、複雑な論理の組み立てに非常に優れています。
            </div>

            {Object.values(PHASES).map((phase) => (
              <div key={phase.id} className="space-y-3">
                <div className="flex justify-between items-end">
                  <div>
                    <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                       {phase.label}
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">{phase.description}</p>
                  </div>
                  <div className="text-[10px] font-bold px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                    推奨：{phase.recommendedTier === 'fast' ? '高速型' : phase.recommendedTier === 'thinking' ? '思考型' : '標準'}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <select
                    value={phaseModels[phase.id]}
                    onChange={(e) => setPhaseModels(prev => ({ ...prev, [phase.id]: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                  >
                    {MODEL_LIST.map(model => (
                      <option key={model.id} value={model.id}>
                        {model.name} ({model.tier === 'fast' ? '高速' : model.tier === 'thinking' ? '思考' : '標準'})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-gray-400 pl-1 italic">
                    {MODEL_LIST.find(m => m.id === phaseModels[phase.id])?.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 space-y-6">
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-[11px] text-amber-800 leading-relaxed italic">
              ※ 使用したいモデルに対応するAPIキーのみ入力してください。
              APIキーはブラウザにのみ保存され、外部（開発者含む）へ送信されることはありません。
            </div>

            {[
              { id: PROVIDERS.GOOGLE, label: 'Google Gemini', placeholder: 'AIzaSy...', link: 'https://aistudio.google.com/app/apikey' },
              { id: PROVIDERS.OPENAI, label: 'OpenAI (GPT)', placeholder: 'sk-proj-...', link: 'https://platform.openai.com/api-keys' },
              { id: PROVIDERS.ANTHROPIC, label: 'Anthropic (Claude)', placeholder: 'sk-ant-api03-...', link: 'https://console.anthropic.com/settings/keys' },
            ].map((provider) => (
              <div key={provider.id} className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 flex justify-between">
                  {provider.label}
                  <a href={provider.link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:underline font-normal">キーを取得 →</a>
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={keys[provider.id]}
                    onChange={(e) => setKeys(prev => ({ ...prev, [provider.id]: e.target.value }))}
                    placeholder={provider.placeholder}
                    className={`w-full px-4 py-3 bg-gray-50 border ${testResult[provider.id] === 'success' ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-200'} rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all pr-24`}
                  />
                  <button
                    onClick={() => handleTestConnection(provider.id)}
                    disabled={!keys[provider.id] || isTesting === provider.id}
                    className="absolute right-2 top-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isTesting === provider.id ? <SpinnerIcon /> : '疎通確認'}
                  </button>
                </div>
                {testResult[provider.id] === 'success' && (
                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 pl-1">
                    <CheckCircleIcon /> 接続成功
                  </div>
                )}
                {testResult[provider.id] === 'error' && (
                  <div className="flex items-center gap-1.5 text-[10px] text-amber-600 pl-1">
                    <AlertTriangleIcon /> 失敗。キーが正しいか確認してください。
                  </div>
                )}
              </div>
            ))}

            <div className="bg-gray-50 p-4 rounded-xl space-y-3 mt-4">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="persist-key"
                  checked={persist}
                  onChange={(e) => setPersist(e.target.checked)}
                  className="mt-1 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                />
                <div>
                  <label htmlFor="persist-key" className="block text-sm font-medium text-gray-700 cursor-pointer">
                    このデバイスに保存する（推奨）
                  </label>
                  <p className="text-[11px] text-gray-500 leading-relaxed mt-0.5">
                    localStorageを使用します。チェックを外すとタブを閉じた際にクリアされます。
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* フッター */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3 justify-end shrink-0">
        {!embedded && (
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          >
            キャンセル
          </button>
        )}
        <button
          onClick={handleSave}
          className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm hover:shadow-md active:scale-95"
        >
          設定を保存
        </button>
      </div>
    </div>
  );
}
