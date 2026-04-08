Adicione esta seção APÓS o campo "Duração" e ANTES da seção "RIGHT SIDE: Content Builder"

Procure por esta linha (por volta da linha 463):
```tsx
                    </div>

                    {/* RIGHT SIDE: Content Builder */}
```

E adicione ANTES de `{/* RIGHT SIDE: Content Builder */}`:

```tsx
                        {/* Scheduling Section */}
                        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
                            <div className="flex items-center gap-2 mb-4">
                                <Calendar size={20} className="text-queen-pink" />
                                <h3 className="font-bold text-lg">Agendamento</h3>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-bold text-gray-300 mb-2 block">
                                        Data de Liberação
                                    </label>
                                    <input
                                        type="date"
                                        className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-queen-pink"
                                        value={formData.startDate}
                                        onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                                    />
                                    <p className="text-xs text-gray-400 mt-1">
                                        Quando este protocolo será liberado para as Rainhas
                                    </p>
                                </div>

                                <div>
                                    <label className="text-sm font-bold text-gray-300 mb-2 block">
                                        Horário de Liberação
                                    </label>
                                    <input
                                        type="time"
                                        className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-queen-pink"
                                        value={formData.startTime}
                                        onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                                    />
                                    <p className="text-xs text-gray-400 mt-1">
                                        Hora em que o protocolo ficará disponível
                                    </p>
                                </div>

                                <div className="flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                                    <input
                                        type="checkbox"
                                        id="auto-activate"
                                        checked={formData.autoActivate}
                                        onChange={e => setFormData({ ...formData, autoActivate: e.target.checked })}
                                        className="w-5 h-5 rounded"
                                    />
                                    <label htmlFor="auto-activate" className="text-sm text-blue-200 cursor-pointer">
                                        ⚡ Ativar automaticamente na data agendada
                                    </label>
                                </div>

                                {formData.startDate && (
                                    <div className="bg-queen-pink/10 border border-queen-pink/30 rounded-xl p-4">
                                        <p className="text-sm text-white/90">
                                            📅 <strong>Período Ativo:</strong><br />
                                            De <strong>{new Date(formData.startDate + 'T00:00').toLocaleDateString('pt-BR')}</strong> às <strong>{formData.startTime}</strong><br />
                                            Até <strong>{new Date(new Date(formData.startDate).getTime() + (formData.duration * 24 * 60 * 60 * 1000)).toLocaleDateString('pt-BR')}</strong>
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
```

Isso vai adicionar uma seção linda de agendamento com:
- Campo de data
- Campo de hora
- Checkbox "Ativar automaticamente"
- Preview do período ativo
