import { SPR_EXAMPLES } from '../../config/examConfig';
import type { SprDirectionsProps } from '../../types/testRoom';
import { T } from '../ui/tokens';

export function SprDirections({ heading = 'How to enter your answer' }: SprDirectionsProps) {
  return (
    <div className="space-y-6 text-[#FAFAFA]">
      <h2 className="text-base font-semibold tracking-tight text-white">
        {heading}
      </h2>

      <ul className="list-disc space-y-2 pl-5 text-sm text-zinc-300 leading-relaxed">
        <li>Enter a single answer even if there are multiple correct solutions.</li>
        <li>Positive answers may contain up to 5 characters; negative answers may contain up to 6 characters (the negative sign counts as one character).</li>
        <li>If a fraction does not fit within the character limit, enter its decimal equivalent.</li>
        <li>If a decimal does not fit within the character limit, truncate or round it at the fourth digit.</li>
        <li>Enter mixed numbers as improper fractions or decimals; do not use spaces.</li>
        <li>Do not include symbols such as percent signs (%), commas (,), or dollar signs ($).</li>
      </ul>

      <div className={`overflow-x-auto ${T.card}`}>
        <table className="w-full border-collapse text-left font-mono text-xs">
          <thead>
            <tr className="border-b border-[#27272A] bg-[#121215] text-zinc-400">
              <th scope="col" className="px-3 py-2 font-medium">Answer</th>
              <th scope="col" className="px-3 py-2 font-medium">Accepted</th>
              <th scope="col" className="px-3 py-2 font-medium">Not accepted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#27272A]">
            {SPR_EXAMPLES.map((ex) => (
              <tr key={ex.answer} className="hover:bg-zinc-900/50">
                <td className="px-3 py-2 font-mono text-white">{ex.answer}</td>
                <td className="px-3 py-2 font-mono text-zinc-300">{ex.accepted.join(', ')}</td>
                <td className="px-3 py-2 font-mono text-zinc-400">{ex.rejected.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
