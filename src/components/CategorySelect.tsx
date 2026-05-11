import type { Category } from "../lib/types";

const categories: {
  key: Category;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    key: "words",
    label: "Single Words",
    description: "Record individual words",
    icon: "Aa",
  },
  {
    key: "sentences",
    label: "Single Words",
    description: "Record full sentences",
    icon: "Aa",
  },
  {
    key: "questions",
    label: "Single Words",
    description: "Record questions",
    icon: "Aa",
  },
  {
    key: "grammar",
    label: "Single Words",
    description: "Record aspects of grammar",
    icon: "Aa",
  }, // include cateogries here, example
];

interface Props {
  onSelect: (category: Category) => void;
  completedCounts: Record<Category, number>;
  totalCounts: Record<Category, number>;
}

export default function CategorySelect({
  onSelect,
  completedCounts,
  totalCounts,
}: Props) {
  return (
    <div className="flex-1 flex flex-col items-center overflow-y-auto min-h-0 p-6">
      <div className="max-w-2xl w-full my-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-charcoal mb-2">
            Record Speech
          </h1>
          <p className="text-charcoal-light">
            Select a category to begin recording
          </p>
        </div>

        <p className="text-center text-sage-dark text-sm mb-6 italic">
          Record at your own pace. You can pause and return anytime.
        </p>

        <div className="grid gap-4 mb-8">
          {categories.map((cat) => {
            const done = completedCounts[cat.key];
            const total = totalCounts[cat.key];
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;

            return (
              <button
                key={cat.key}
                onClick={() => onSelect(cat.key)}
                className="group bg-white rounded-2xl p-6 shadow-sm border border-cream-dark hover:shadow-md hover:border-sage transition-all text-left flex items-center gap-5 cursor-pointer"
              >
                <div className="w-14 h-14 rounded-xl bg-cream group-hover:bg-sage-light/40 flex items-center justify-center text-forest-dark font-bold text-xl transition-colors shrink-0">
                  {cat.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold text-charcoal">
                    {cat.label}
                  </h2>
                  <p className="text-charcoal-light text-sm">
                    {cat.description}
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-cream-dark rounded-full overflow-hidden">
                      <div
                        className="h-full bg-forest-dark rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-charcoal-light tabular-nums whitespace-nowrap">
                      {done}/{total}
                    </span>
                  </div>
                </div>
                <svg
                  className="w-5 h-5 text-sage-dark group-hover:text-forest-dark transition-colors shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
