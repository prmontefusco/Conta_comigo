"use client";

import { SelectField } from "@/components/ui/form";
import { useMembers } from "./use-members";

/**
 * "Whose is this?" as a real member, not a typed name.
 *
 * Shown only when the household has more than one person: asking a single
 * person to attribute every record to themselves is noise, and the field
 * appears on its own the day someone else joins.
 */
export function MemberField({
  label = "De quem é",
  hint,
  value,
  onChange,
  emptyLabel = "Do grupo (todos)",
}: {
  label?: string;
  hint?: string;
  value: string;
  onChange: (memberId: string) => void;
  emptyLabel?: string;
}) {
  const { active } = useMembers();

  if (active.length < 2) return null;

  return (
    <SelectField
      label={label}
      hint={hint}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      options={[
        { value: "", label: emptyLabel },
        ...active.map((member) => ({ value: member.id, label: member.displayName })),
      ]}
    />
  );
}

/** The member's name as a short inline label, or nothing when unattributed. */
export function MemberBadgeLabel({ memberId }: { memberId?: string }) {
  const { nameOf } = useMembers();
  if (!memberId) return null;
  return <>{nameOf(memberId)}</>;
}
