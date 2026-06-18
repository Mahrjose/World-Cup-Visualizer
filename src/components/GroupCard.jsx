import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, RotateCcw } from 'lucide-react';
import Flag from './Flag';

const STAT_FIELDS = [
  { key: 'mp', label: 'MP', editable: false, hideOnMobile: true },
  { key: 'w', label: 'W', editable: true },
  { key: 'd', label: 'D', editable: true },
  { key: 'l', label: 'L', editable: true },
  { key: 'gf', label: 'GF', editable: true, hideOnMobile: true },
  { key: 'ga', label: 'GA', editable: true, hideOnMobile: true },
  { key: 'gd', label: 'GD', editable: false, hideOnMobile: true },
  { key: 'pts', label: 'Pts', editable: false, emphasize: true },
];

function StatCell({ team, field, onEdit }) {
  const value = team[field.key];
  if (!field.editable) {
    const sign = field.key === 'gd' && value > 0 ? '+' : '';
    return (
      <span
        className={
          field.emphasize
            ? 'font-mono font-bold text-ink tabular-nums'
            : 'font-mono text-slate-muted tabular-nums'
        }
      >
        {sign}
        {value}
      </span>
    );
  }
  return (
    <input
      type="number"
      className="stat-input font-mono tabular-nums"
      value={value}
      onChange={(e) => onEdit(team.id, field.key, e.target.value)}
      onFocus={(e) => e.target.select()}
      aria-label={`${team.name} ${field.label}`}
    />
  );
}

function SortableRow({ team, isOverridden, onEdit }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: team.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const rankStyles =
    team.rank <= 2
      ? 'bg-whistle/15'
      : team.rank === 3
      ? 'bg-pitch/[0.06]'
      : 'bg-transparent';

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`${rankStyles} ${isDragging ? 'opacity-60 z-10 relative shadow-lg' : ''} border-b border-slate-line/60 last:border-b-0`}
    >
      <td className="w-7 pl-2 py-1.5 text-slate-muted">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none p-1 -ml-1 rounded hover:bg-black/5"
          aria-label={`Drag to reorder ${team.name}`}
        >
          <GripVertical size={13} />
        </button>
      </td>
      <td className="w-5 text-center font-display font-bold text-sm text-ink tabular-nums">
        {team.rank}
      </td>
      <td className="py-1.5 pr-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <Flag code={team.flag} name={team.name} className="w-5 h-3.5 flex-shrink-0" />
          <span className="text-[12.5px] font-medium text-ink truncate">{team.name}</span>
          {isOverridden && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-pitch flex-shrink-0"
              title="Manually reordered"
            />
          )}
        </div>
      </td>
      {STAT_FIELDS.map((f) => (
        <td key={f.key} className={`text-center py-1.5 px-0.5${f.hideOnMobile ? ' hidden sm:table-cell' : ''}`}>
          <StatCell team={team} field={f} onEdit={onEdit} />
        </td>
      ))}
    </tr>
  );
}

export default function GroupCard({ groupLetter, teams, isManual, onReorder, onEdit, onClearManual }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = teams.map((t) => t.id);
    const oldIndex = ids.indexOf(active.id);
    const newIndex = ids.indexOf(over.id);
    onReorder(groupLetter, arrayMove(ids, oldIndex, newIndex));
  }

  return (
    <div className="bg-cream rounded-lg border border-slate-line overflow-hidden flex flex-col">
      <div className="flex items-center justify-between bg-pitch px-3 py-2">
        <h3 className="font-display font-bold text-cream tracking-wide text-sm">
          GROUP {groupLetter}
        </h3>
        {isManual && (
          <button
            onClick={() => onClearManual(groupLetter)}
            className="flex items-center gap-1 text-[10px] text-whistle/90 hover:text-whistle font-medium"
            title="Reset to computed order"
          >
            <RotateCcw size={11} />
            Reset order
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-[10px] text-slate-muted border-b border-slate-line">
              <th className="w-7"></th>
              <th className="w-5"></th>
              <th className="text-left pl-1 py-1 font-medium">Team</th>
              {STAT_FIELDS.map((f) => (
                <th key={f.key} className={`font-medium py-1 px-0.5${f.hideOnMobile ? ' hidden sm:table-cell' : ''}`}>
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={teams.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <tbody>
                {teams.map((team) => (
                  <SortableRow
                    key={team.id}
                    team={team}
                    isOverridden={isManual}
                    onEdit={(teamId, field, value) => onEdit(groupLetter, teamId, field, value)}
                  />
                ))}
              </tbody>
            </SortableContext>
          </DndContext>
        </table>
      </div>
    </div>
  );
}
