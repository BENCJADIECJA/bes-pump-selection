// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import axios from 'axios'

export type PumpRow = Record<string, any>

export type PumpColumnMeta = {
  key: string
  type: 'string' | 'number'
  required: boolean
  read_only?: boolean
  label?: string
}

export type PumpManagerModalProps = {
  isOpen: boolean
  onClose: () => void
  onSelect: (pumpId: string, row: PumpRow) => void
  onCatalogChanged?: () => Promise<void> | void
  activePumpId?: string | null
}

const FILTER_PRESETS = [
  { id: 'model', label: 'Modelo', matches: ['tipo', 'modelo', 'model', 'pump', 'bomba'] },
  { id: 'series', label: 'Serie', matches: ['serie', 'series'] },
  { id: 'range', label: 'Rango Operativo', matches: ['rango operativo', 'operating range', 'rango'] },
  { id: 'od', label: 'OD (mm)', matches: ['od', 'od mm', 'od (mm)', 'diametro', 'd.e.'] }
]

const PumpManagerModal: React.FC<PumpManagerModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  onCatalogChanged,
  activePumpId
}) => {
  const [columns, setColumns] = useState<PumpColumnMeta[]>([])
  const [rows, setRows] = useState<PumpRow[]>([])
  const [idColumn, setIdColumn] = useState<string>('id')
  const [displayColumn, setDisplayColumn] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [filters, setFilters] = useState<Record<string, string>>({})
  const [sortState, setSortState] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Record<string, string>>({})
  const [editErrors, setEditErrors] = useState<Record<string, string>>({})
  const [editSaving, setEditSaving] = useState(false)

  const [adding, setAdding] = useState(false)
  const [addDraft, setAddDraft] = useState<Record<string, string>>({})
  const [addErrors, setAddErrors] = useState<Record<string, string>>({})
  const [addSaving, setAddSaving] = useState(false)

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isFullscreen, setFullscreen] = useState(false)

  const columnMap = useMemo(() => {
    const map: Record<string, PumpColumnMeta> = {}
    columns.forEach((column) => {
      map[column.key] = column
    })
    return map
  }, [columns])

  const activeValue = activePumpId != null ? String(activePumpId) : null

  const resolveCatalogChange = useCallback(async () => {
    if (onCatalogChanged) {
      await Promise.resolve(onCatalogChanged())
    }
  }, [onCatalogChanged])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await axios.get('/api/pump_coefficients')
      const payload = response.data || {}

      if (payload.success === false) {
        throw new Error(payload.error || 'No se pudieron cargar los coeficientes de bomba.')
      }

      const columnList: PumpColumnMeta[] = Array.isArray(payload.columns) ? payload.columns : []
      const dataRows: PumpRow[] = Array.isArray(payload.data) ? payload.data : []

      setColumns(columnList)
      setRows(dataRows)
      setIdColumn(typeof payload.id_column === 'string' ? payload.id_column : 'id')
      setDisplayColumn(typeof payload.display_column === 'string' ? payload.display_column : null)

      setFilters((prev) => {
        const next: Record<string, string> = {}
        columnList.forEach((column) => {
          if (prev[column.key]) {
            next[column.key] = prev[column.key]
          }
        })
        return next
      })

      setSortState(null)
      setEditingId(null)
      setEditDraft({})
      setEditErrors({})
      setEditSaving(false)
      setAdding(false)
      setAddDraft({})
      setAddErrors({})
      setAddSaving(false)
      setDeletingId(null)
  setFullscreen(false)
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || 'No se pudieron cargar los coeficientes.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      loadData()
    } else {
      setEditingId(null)
      setEditDraft({})
      setEditErrors({})
      setAdding(false)
      setAddDraft({})
      setAddErrors({})
      setError(null)
      setFullscreen(false)
    }
  }, [isOpen, loadData])

  const matchedFilters = useMemo(() => {
    if (!columns.length) return [] as Array<{ id: string; label: string; columnKey: string }>

    const availableKeys = columns.map((column) => column.key)
    const selectedKeys = new Set<string>()

    return FILTER_PRESETS.map((preset) => {
      const match = availableKeys.find((candidate) => {
        if (selectedKeys.has(candidate)) return false
        return preset.matches.some((needle) => candidate.toLowerCase().includes(needle))
      })

      if (match) {
        selectedKeys.add(match)
        return { id: preset.id, label: preset.label, columnKey: match }
      }
      return null
    }).filter(Boolean) as Array<{ id: string; label: string; columnKey: string }>
  }, [columns])

  const filteredRows = useMemo(() => {
    if (!matchedFilters.length) {
      return rows
    }
    return rows.filter((row) => {
      return matchedFilters.every(({ columnKey }) => {
        const filterValue = filters[columnKey]
        if (!filterValue) return true
        const cellValue = row[columnKey]
        if (cellValue === null || cellValue === undefined) return false
        return String(cellValue).toLowerCase().includes(filterValue.toLowerCase())
      })
    })
  }, [rows, matchedFilters, filters])

  const sortedRows = useMemo(() => {
    if (!sortState) return filteredRows
    const { column, direction } = sortState
    const meta = columnMap[column]
    const multiplier = direction === 'asc' ? 1 : -1

    return [...filteredRows].sort((a, b) => {
      const aValue = a[column]
      const bValue = b[column]
      if (meta?.type === 'number') {
        const aNum = aValue === null || aValue === undefined || aValue === '' ? Number.NaN : Number(aValue)
        const bNum = bValue === null || bValue === undefined || bValue === '' ? Number.NaN : Number(bValue)
        if (Number.isNaN(aNum) && Number.isNaN(bNum)) return 0
        if (Number.isNaN(aNum)) return 1
        if (Number.isNaN(bNum)) return -1
        if (aNum === bNum) return 0
        return aNum > bNum ? multiplier : -multiplier
      }

      const aText = aValue == null ? '' : String(aValue).toLowerCase()
      const bText = bValue == null ? '' : String(bValue).toLowerCase()
      if (aText === bText) return 0
      return aText > bText ? multiplier : -multiplier
    })
  }, [filteredRows, sortState, columnMap])

  const toggleSort = (columnKey: string) => {
    setSortState((prev) => {
      if (!prev || prev.column !== columnKey) {
        return { column: columnKey, direction: 'asc' }
      }
      if (prev.direction === 'asc') {
        return { column: columnKey, direction: 'desc' }
      }
      return null
    })
  }

  const handleFilterChange = (columnKey: string, value: string) => {
    setFilters((prev) => ({ ...prev, [columnKey]: value }))
  }

  const handleEditInputChange = (columnKey: string, value: string) => {
    setEditDraft((prev) => ({ ...prev, [columnKey]: value }))
  }

  const handleAddInputChange = (columnKey: string, value: string) => {
    setAddDraft((prev) => ({ ...prev, [columnKey]: value }))
  }

  const buildPayload = (draft: Record<string, string>) => {
    const payload: Record<string, any> = {}
    columns.forEach((column) => {
      if (column.key === idColumn) {
        return
      }
      const rawValue = draft[column.key]
      if (rawValue === undefined || rawValue === null || rawValue === '') {
        payload[column.key] = null
      } else {
        payload[column.key] = rawValue
      }
    })
    return payload
  }

  const openEditRow = (row: PumpRow) => {
    const rowId = row[idColumn]
    if (rowId === undefined || rowId === null) return

    const draft: Record<string, string> = {}
    columns.forEach((column) => {
      if (column.key === idColumn) {
        return
      }
      const value = row[column.key]
      draft[column.key] = value === null || value === undefined ? '' : String(value)
    })

    setEditingId(String(rowId))
    setEditDraft(draft)
    setEditErrors({})
    setEditSaving(false)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditDraft({})
    setEditErrors({})
    setEditSaving(false)
  }

  const openAddPanel = () => {
    const draft: Record<string, string> = {}
    columns.forEach((column) => {
      if (column.key !== idColumn) {
        draft[column.key] = ''
      }
    })
    setAddDraft(draft)
    setAddErrors({})
    setAddSaving(false)
    setAdding(true)
  }

  const cancelAdd = () => {
    setAdding(false)
    setAddDraft({})
    setAddErrors({})
    setAddSaving(false)
  }

  const handleSaveEdit = async () => {
    if (!editingId) return
    setEditSaving(true)
    setEditErrors({})
    try {
      const payload = buildPayload(editDraft)
      const url = `/api/pump_coefficients/${encodeURIComponent(editingId)}`
      await axios.put(url, payload)
      await loadData()
      await resolveCatalogChange()
      setEditingId(null)
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response?.status === 422) {
        const details = err.response?.data?.details || {}
        setEditErrors(details)
      } else {
        const message = err?.response?.data?.error || err?.message || 'No se pudo guardar la bomba.'
        setError(message)
      }
    } finally {
      setEditSaving(false)
    }
  }

  const handleSaveAdd = async () => {
    setAddSaving(true)
    setAddErrors({})
    try {
      const payload = buildPayload(addDraft)
      await axios.post('/api/pump_coefficients', payload)
      await loadData()
      await resolveCatalogChange()
      setAdding(false)
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response?.status === 422) {
        const details = err.response?.data?.details || {}
        setAddErrors(details)
      } else {
        const message = err?.response?.data?.error || err?.message || 'No se pudo agregar la bomba.'
        setError(message)
      }
    } finally {
      setAddSaving(false)
    }
  }

  const handleDeleteRow = async (row: PumpRow) => {
    const rowId = row[idColumn]
    if (rowId === undefined || rowId === null) return
    if (!window.confirm('¿Eliminar esta bomba del catálogo?')) {
      return
    }
    setDeletingId(String(rowId))
    try {
      const url = `/api/pump_coefficients/${encodeURIComponent(String(rowId))}`
      await axios.delete(url)
      await loadData()
      await resolveCatalogChange()
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || 'No se pudo eliminar la bomba.'
      setError(message)
    } finally {
      setDeletingId(null)
    }
  }

  const handleSelectRow = (row: PumpRow) => {
    const displayKey = displayColumn || idColumn
    const value = row[displayKey]
    if (value === undefined || value === null || value === '') {
      return
    }
    onSelect(String(value), row)
    handleRequestClose()
  }

  const formatDisplayValue = useCallback(
    (value: any, columnKey: string) => {
      if (value === null || value === undefined || value === '') {
        return null
      }

      const meta = columnMap[columnKey]
      if (meta?.type === 'number') {
        const numericValue = Number(value)
        if (!Number.isFinite(numericValue)) {
          return String(value)
        }
        return numericValue.toExponential(3).toUpperCase()
      }

      return String(value)
    },
    [columnMap]
  )

  const handleRequestClose = () => {
    cancelEdit()
    cancelAdd()
    onClose()
    setFullscreen(false)
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="pump-manager-backdrop" onClick={handleRequestClose}>
      <div
        className={isFullscreen ? 'pump-manager pump-manager--fullscreen' : 'pump-manager'}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="pump-manager__header">
          <div>
            <h2 className="pump-manager__title">Gestionar Bombas</h2>
            <p className="pump-manager__subtitle">Editar coeficientes, agregar modelos y cargar una bomba al simulador.</p>
          </div>
          <div className="pump-manager__header-actions">
            <button
              type="button"
              className="pump-manager__button pump-manager__button--ghost pump-manager__button--icon"
              onClick={() => setFullscreen((prev) => !prev)}
              aria-label={isFullscreen ? 'Restaurar tamaño del modal' : 'Expandir modal'}
              title={isFullscreen ? 'Restaurar tamaño del modal' : 'Expandir modal'}
            >
              {isFullscreen ? '⤢' : '⤡'}
            </button>
            <button
              type="button"
              className="pump-manager__button pump-manager__button--primary"
              onClick={adding ? handleSaveAdd : openAddPanel}
              disabled={loading || editSaving || addSaving}
            >
              {adding ? 'Guardar bomba' : 'Agregar bomba'}
            </button>
            <button type="button" className="pump-manager__close" onClick={handleRequestClose} aria-label="Cerrar">
              ✕
            </button>
          </div>
        </header>
        <div className="pump-manager__body">
          {error && <div className="pump-manager__alert pump-manager__alert--error">{error}</div>}
          {adding && (
            <div className="pump-manager__add-panel">
              <h3 className="pump-manager__section-title">Nueva bomba</h3>
              <div className="pump-manager__form-grid">
                {columns
                  .filter((column) => column.key !== idColumn)
                  .map((column) => {
                    const value = addDraft[column.key] ?? ''
                    const errorText = addErrors[column.key]
                    const isNumeric = column.type === 'number'
                    return (
                      <label key={`add-${column.key}`} className="pump-manager__form-field">
                        <span className="pump-manager__label">
                          {column.label || column.key}
                          {column.required && <sup>*</sup>}
                        </span>
                        <input
                          className={`pump-manager__input ${errorText ? 'pump-manager__input--error' : ''}`}
                          type={isNumeric ? 'number' : 'text'}
                          step={isNumeric ? 'any' : undefined}
                          value={value}
                          onChange={(event) => handleAddInputChange(column.key, event.target.value)}
                          disabled={addSaving}
                        />
                        {errorText && <span className="pump-manager__error-text">{errorText}</span>}
                      </label>
                    )
                  })}
              </div>
              <div className="pump-manager__form-actions">
                <button
                  type="button"
                  className="pump-manager__button pump-manager__button--primary"
                  onClick={handleSaveAdd}
                  disabled={addSaving}
                >
                  Guardar cambios
                </button>
                <button
                  type="button"
                  className="pump-manager__button pump-manager__button--ghost"
                  onClick={cancelAdd}
                  disabled={addSaving}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="pump-manager__filters">
            {matchedFilters.map(({ id, label, columnKey }) => (
              <label key={id} className="pump-manager__filter-field">
                <span>{label}</span>
                <input
                  type="text"
                  value={filters[columnKey] ?? ''}
                  onChange={(event) => handleFilterChange(columnKey, event.target.value)}
                  placeholder={`Filtrar por ${label.toLowerCase()}`}
                />
              </label>
            ))}
          </div>

          <div className="pump-manager__table-container">
            {loading ? (
              <div className="pump-manager__empty">Cargando catálogo…</div>
            ) : sortedRows.length === 0 ? (
              <div className="pump-manager__empty">No se encontraron bombas con los filtros actuales.</div>
            ) : (
              <table className="pump-manager__table">
                <thead>
                  <tr>
                    {columns.map((column) => {
                      const isSorted = sortState?.column === column.key
                      const sortIndicator = !isSorted ? '' : sortState?.direction === 'asc' ? '▲' : '▼'
                      return (
                        <th
                          key={column.key}
                          className={column.read_only ? 'pump-manager__header pump-manager__header--readonly' : 'pump-manager__header'}
                          onClick={() => {
                            if (!column.read_only) {
                              toggleSort(column.key)
                            }
                          }}
                        >
                          <span>{column.label || column.key}</span>
                          {sortIndicator && <span className="pump-manager__sort-indicator">{sortIndicator}</span>}
                        </th>
                      )
                    })}
                    <th className="pump-manager__header pump-manager__header--actions">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row, index) => {
                    const rowId = row[idColumn]
                    const isEditing = editingId === String(rowId)
                    const displayKey = displayColumn || idColumn
                    const displayValue = row[displayKey]
                    const isActiveRow = activeValue && displayValue != null && String(displayValue) === activeValue
                    const rowClassName = isActiveRow ? 'pump-manager__row pump-manager__row--active' : 'pump-manager__row'
                    const rowKey = rowId != null ? String(rowId) : `${displayValue ?? 'row'}-${index}`

                    return (
                      <tr key={rowKey} className={rowClassName} onDoubleClick={() => handleSelectRow(row)}>
                        {columns.map((column) => {
                          const value = row[column.key]
                          const currentDraft = isEditing ? editDraft[column.key] ?? '' : value
                          const errorText = isEditing ? editErrors[column.key] : undefined
                          const isNumeric = column.type === 'number'
                          const isReadOnly = column.read_only || column.key === idColumn
                          const formattedValue = isEditing && !isReadOnly ? null : formatDisplayValue(value, column.key)

                          if (isEditing && !isReadOnly) {
                            return (
                              <td key={`${rowId}-${column.key}`} className="pump-manager__cell pump-manager__cell--editing">
                                <div className="pump-manager__cell-editor">
                                  <input
                                    className={`pump-manager__input ${errorText ? 'pump-manager__input--error' : ''}`}
                                    type={isNumeric ? 'number' : 'text'}
                                    step={isNumeric ? 'any' : undefined}
                                    value={currentDraft}
                                    onChange={(event) => handleEditInputChange(column.key, event.target.value)}
                                    disabled={editSaving}
                                  />
                                  {errorText && <span className="pump-manager__error-text">{errorText}</span>}
                                </div>
                              </td>
                            )
                          }

                          return (
                            <td key={`${rowId}-${column.key}`} className="pump-manager__cell">
                              {formattedValue === null ? (
                                <span className="pump-manager__empty">—</span>
                              ) : (
                                <span title={formattedValue}>{formattedValue}</span>
                              )}
                            </td>
                          )
                        })}
                        <td className="pump-manager__cell pump-manager__cell--actions">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                className="pump-manager__button pump-manager__button--primary"
                                onClick={handleSaveEdit}
                                disabled={editSaving}
                              >
                                Guardar
                              </button>
                              <button
                                type="button"
                                className="pump-manager__button pump-manager__button--ghost"
                                onClick={cancelEdit}
                                disabled={editSaving}
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="pump-manager__button pump-manager__button--ghost"
                                onClick={() => openEditRow(row)}
                                disabled={Boolean(editingId) || Boolean(deletingId)}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="pump-manager__button pump-manager__button--primary"
                                onClick={() => handleSelectRow(row)}
                                disabled={Boolean(editingId)}
                              >
                                Seleccionar
                              </button>
                              <button
                                type="button"
                                className="pump-manager__button pump-manager__button--danger"
                                onClick={() => handleDeleteRow(row)}
                                disabled={Boolean(editingId) || deletingId === String(rowId)}
                              >
                                {deletingId === String(rowId) ? 'Eliminando…' : 'Eliminar'}
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default PumpManagerModal
