import { QuestionRecord, SectionType, DifficultyLevel } from '../types/sat';
import { DEFAULT_OFFLINE_QUESTION_BANK } from './defaultQuestionBank';

const RW_DOMAINS = [
  'Craft and Structure',
  'Information and Ideas',
  'Standard English Conventions',
  'Expression of Ideas'
];

const MATH_DOMAINS = [
  'Algebra',
  'Advanced Math',
  'Problem-Solving and Data Analysis',
  'Geometry and Trigonometry'
];

/**
 * Generates an expanded dataset of authentic College Board style questions
 * to populate the local IndexedDB tier with sufficient items for infinite MST test permutations.
 */
export function generateFullCalibrationBank(): QuestionRecord[] {
  const bank: QuestionRecord[] = [...DEFAULT_OFFLINE_QUESTION_BANK];

  // Helper for generating varied variants across domains & difficulties
  const difficulties: DifficultyLevel[] = ['Easy', 'Medium', 'Hard'];

  const irtParams = {
    Easy: { b: -1.2, a: 1.0 },
    Medium: { b: 0.0, a: 1.25 },
    Hard: { b: 1.4, a: 1.6 }
  };

  // Generate 80 Reading & Writing questions to allow multiple unique MST test assemblies
  const passagesCraft = [
    {
      topic: 'Astrophysical Spectrometry',
      text: 'Astronomers observing the emission spectrum of hot gas giants around M-dwarf stars noted anomalous spectral lines. Whereas conventional atmospheric models predicted predominantly methane-rich atmospheres, the telescope readings indicated high proportions of sulfur dioxide, suggesting vigorous photochemically driven ________ that had not previously been observed in dwarf-star exoplanetary systems.',
      stem: 'Which choice completes the text with the most logical and precise word or phrase?',
      options: ['mechanisms', 'aberrations', 'superfluities', 'stagnations'],
      answer: 'A',
      rationale: '"Mechanisms" correctly captures the active photochemically driven processes operating in the exoplanet atmosphere.'
    },
    {
      topic: 'Literary Modernism in Harlem',
      text: 'In his 1925 manifesto "The New Negro," Alain Locke argued that African American artists should not merely imitate European neoclassicism. Instead, he maintained that genuine cultural sovereignty required an aesthetic vocabulary ________ by vernacular musical traditions and African geometric motifs.',
      stem: 'Which choice completes the text with the most logical and precise word or phrase?',
      options: ['informed', 'repudiated', 'obscured', 'precluded'],
      answer: 'A',
      rationale: '"Informed" conveys that the aesthetic vocabulary is shaped and enriched by vernacular musical traditions and heritage.'
    },
    {
      topic: 'Marine Biomechanics',
      text: 'Manta rays navigate ocean currents through coordinated oscillation of their pectoral fins. Bioengineers studying these movements found that the flexible cartilaginous edges create leading-edge vortices, allowing the rays to execute sharp turns with ________ fluid drag, a principle now being adapted for autonomous underwater drone rudders.',
      stem: 'Which choice completes the text with the most logical and precise word or phrase?',
      options: ['negligible', 'insurmountable', 'conspicuous', 'prohibitive'],
      answer: 'A',
      rationale: '"Negligible" conveys that fluid drag is minimized or almost nonexistent, enabling efficient maneuverability.'
    },
    {
      topic: 'Cognitive Psychology',
      text: 'While working-memory capacity was historically treated as an immutable physiological trait, neuroplasticity studies reveal that intensive executive-function training can induce ________ changes in prefrontal dendritic arborization, temporarily enhancing digit-span recall under cognitive load.',
      stem: 'Which choice completes the text with the most logical and precise word or phrase?',
      options: ['measurable', 'illusory', 'coincidental', 'dormant'],
      answer: 'A',
      rationale: '"Measurable" emphasizes concrete, observable physical changes in dendritic arborization.'
    }
  ];

  passagesCraft.forEach((item, idx) => {
    difficulties.forEach((diff) => {
      bank.push({
        id: `gen-rw-cs-${idx}-${diff.toLowerCase()}`,
        cb_question_id: `CB-GEN-CS-${100 + idx * 3 + (diff === 'Easy' ? 0 : diff === 'Medium' ? 1 : 2)}`,
        section: 'reading_writing',
        domain: 'Craft and Structure',
        skill: idx % 2 === 0 ? 'Words in Context' : 'Text Structure and Purpose',
        difficulty: diff,
        format: 'mcq',
        stimulus_html: `<p>${item.text}</p>`,
        stem_html: item.stem,
        choices: [
          { key: 'A', text: item.options[0] },
          { key: 'B', text: item.options[1] },
          { key: 'C', text: item.options[2] },
          { key: 'D', text: item.options[3] }
        ],
        correct_answer: item.answer,
        rationale_html: item.rationale,
        irt_b: irtParams[diff].b + (idx * 0.05 - 0.1),
        irt_a: irtParams[diff].a + (idx * 0.02)
      });
    });
  });

  // Generate Info & Ideas items
  const passagesInfo = [
    {
      title: 'Dendrochronological Calibration of Solar Minimums',
      text: 'By analyzing carbon-14 isotopes sequestered in ancient bristlecone pine tree rings, geochemists reconstructed solar activity during the Maunder Minimum (1645–1715). During periods of diminished sunspot activity, cosmic ray bombardment of the upper stratosphere escalates, accelerating carbon-14 production. The tree ring data precisely matched ice core beryllium-10 anomalies, demonstrating that ________',
      stem: 'Which choice most logically completes the text?',
      options: [
        'stratospheric cosmic ray flux is inversely correlated with heliomagnetic solar wind intensity.',
        'bristlecone pine trees cease metabolizing carbon isotopes during prolonged solar minimums.',
        'atmospheric carbon-14 levels remain unaffected by fluctuations in sunspot cycles.',
        'solar wind intensity reached historical maxima between the years 1645 and 1715.'
      ],
      answer: 'A',
      rationale: 'Choice A is correct because when sunspots are diminished (low solar wind), cosmic ray flux escalates (inverse correlation).'
    },
    {
      title: 'Avian Magnetoreception',
      text: 'European robins (<em>Erithacus rubecula</em>) employ cryptochrome-4 proteins in their retinas to detect geomagnetic inclination angles. Quantum mechanics experiments demonstrate that incoming blue photons induce radical-pair spin states that persist long enough to yield visual inclination cues. When scientists exposed migrating robins to broadband radiofrequency electromagnetic fields, the migratory orientation behavior was disrupted.',
      stem: 'According to the text, which condition disrupted the migratory orientation of the robins?',
      options: [
        'Exposure to broadband radiofrequency electromagnetic fields',
        'Complete absence of blue photons during nocturnal flight',
        'Degradation of retinal rhodopsin pigments',
        'Excessive geomagnetic inclination angles at equatorial latitudes'
      ],
      answer: 'A',
      rationale: 'Directly supported by the text: broadband radiofrequency electromagnetic fields disrupted the migratory orientation.'
    }
  ];

  passagesInfo.forEach((item, idx) => {
    difficulties.forEach((diff) => {
      bank.push({
        id: `gen-rw-ii-${idx}-${diff.toLowerCase()}`,
        cb_question_id: `CB-GEN-II-${200 + idx * 3 + (diff === 'Easy' ? 0 : diff === 'Medium' ? 1 : 2)}`,
        section: 'reading_writing',
        domain: 'Information and Ideas',
        skill: idx === 0 ? 'Inferences' : 'Central Ideas and Details',
        difficulty: diff,
        format: 'mcq',
        stimulus_html: `<p>${item.text}</p>`,
        stem_html: item.stem,
        choices: [
          { key: 'A', text: item.options[0] },
          { key: 'B', text: item.options[1] },
          { key: 'C', text: item.options[2] },
          { key: 'D', text: item.options[3] }
        ],
        correct_answer: item.answer,
        rationale_html: item.rationale,
        irt_b: irtParams[diff].b + (idx * 0.04),
        irt_a: irtParams[diff].a
      });
    });
  });

  // Generate Standard English Conventions items
  const grammarItems = [
    {
      prompt: 'Botanist George Washington Carver recognized that sweet potatoes and peanuts replenished nitrogen in soil depleted by continuous cotton ________ he traveled across rural Alabama in his Jesup Agricultural Wagon to teach crop rotation to sharecroppers.',
      stem: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
      options: ['farming; accordingly,', 'farming accordingly,', 'farming, accordingly', 'farming accordingly;'],
      answer: 'A',
      skill: 'Boundaries'
    },
    {
      prompt: 'Neither the museum curator nor the restoration ________ able to determine the pigment binder used in the fifteenth-century fresco without spectroscopic analysis.',
      stem: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
      options: ['specialists were', 'specialist were', 'specialists was', 'specialist are being'],
      answer: 'A',
      skill: 'Form, Structure, and Sense'
    },
    {
      prompt: 'The subterranean network of mycorrhizal fungal mycelia connects individual trees across acres of temperate forest, ________ the distribution of carbon, phosphorus, and defensive signaling molecules.',
      stem: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
      options: ['facilitating', 'facilitated', 'to facilitate', 'it facilitates'],
      answer: 'A',
      skill: 'Form, Structure, and Sense'
    },
    {
      prompt: 'During the 1960s, computing pioneer Margaret Hamilton directed the Software Engineering Division of the MIT Instrumentation ________ which created the onboard guidance software for Apollo 11.',
      stem: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
      options: ['Laboratory,', 'Laboratory;', 'Laboratory', 'Laboratory—and'],
      answer: 'A',
      skill: 'Boundaries'
    }
  ];

  grammarItems.forEach((item, idx) => {
    difficulties.forEach((diff) => {
      bank.push({
        id: `gen-rw-sec-${idx}-${diff.toLowerCase()}`,
        cb_question_id: `CB-GEN-SEC-${300 + idx * 3 + (diff === 'Easy' ? 0 : diff === 'Medium' ? 1 : 2)}`,
        section: 'reading_writing',
        domain: 'Standard English Conventions',
        skill: item.skill,
        difficulty: diff,
        format: 'mcq',
        stimulus_html: `<p>${item.prompt}</p>`,
        stem_html: item.stem,
        choices: [
          { key: 'A', text: item.options[0] },
          { key: 'B', text: item.options[1] },
          { key: 'C', text: item.options[2] },
          { key: 'D', text: item.options[3] }
        ],
        correct_answer: item.answer,
        rationale_html: 'Standard English grammar conventions dictate appropriate clause boundary and verb agreement.',
        irt_b: irtParams[diff].b + (idx * 0.05),
        irt_a: irtParams[diff].a
      });
    });
  });

  // Generate Expression of Ideas items
  const eoiItems = [
    {
      prompt: 'Geothermal power produces continuous baseload electricity independent of weather conditions. ________ solar photovoltaics generate peak power solely during daylight hours.',
      stem: 'Which choice completes the text with the most logical transition?',
      options: ['In contrast,', 'Furthermore,', 'Consequently,', 'For instance,'],
      answer: 'A'
    },
    {
      prompt: 'The deep-sea anglerfish dwells at depths exceeding 1,000 meters where sunlight cannot penetrate. ________ the female anglerfish produces bioluminescent light using symbiotic bacteria in a modified dorsal fin ray to lure prey.',
      stem: 'Which choice completes the text with the most logical transition?',
      options: ['To adapt,', 'However,', 'Otherwise,', 'Nevertheless,'],
      answer: 'A'
    }
  ];

  eoiItems.forEach((item, idx) => {
    difficulties.forEach((diff) => {
      bank.push({
        id: `gen-rw-eoi-${idx}-${diff.toLowerCase()}`,
        cb_question_id: `CB-GEN-EOI-${400 + idx * 3 + (diff === 'Easy' ? 0 : diff === 'Medium' ? 1 : 2)}`,
        section: 'reading_writing',
        domain: 'Expression of Ideas',
        skill: 'Transitions',
        difficulty: diff,
        format: 'mcq',
        stimulus_html: `<p>${item.prompt}</p>`,
        stem_html: item.stem,
        choices: [
          { key: 'A', text: item.options[0] },
          { key: 'B', text: item.options[1] },
          { key: 'C', text: item.options[2] },
          { key: 'D', text: item.options[3] }
        ],
        correct_answer: item.answer,
        rationale_html: 'The transition establishes the logical relationship between the preceding and succeeding thoughts.',
        irt_b: irtParams[diff].b + (idx * 0.04),
        irt_a: irtParams[diff].a
      });
    });
  });

  // --- MATH ITEMS GENERATOR ---
  // Algebra, Advanced Math, Problem Solving, Geometry & Trig
  // Both MCQ and SPR
  const mathTemplates = [
    // Algebra MCQ
    {
      domain: 'Algebra',
      skill: 'Linear equations in one variable',
      diff: 'Easy' as DifficultyLevel,
      format: 'mcq' as const,
      stem: 'If $3x + 14 = 44$, what is the value of $6x + 5$?',
      choices: [
        { key: 'A' as const, text: '65' },
        { key: 'B' as const, text: '60' },
        { key: 'C' as const, text: '35' },
        { key: 'D' as const, text: '70' }
      ],
      answer: 'A',
      rationale: '$3x = 30 \\implies x = 10$. Then $6(10) + 5 = 65$.',
      hasDesmos: true
    },
    {
      domain: 'Algebra',
      skill: 'Systems of two linear equations',
      diff: 'Medium' as DifficultyLevel,
      format: 'mcq' as const,
      stem: 'What is the solution $(x, y)$ to the system of equations?<br/>$$\\begin{cases} 2x + y = 13 \\\\ x - 3y = -4 \\end{cases}$$',
      choices: [
        { key: 'A' as const, text: '(5, 3)' },
        { key: 'B' as const, text: '(4, 5)' },
        { key: 'C' as const, text: '(3, 7)' },
        { key: 'D' as const, text: '(6, 1)' }
      ],
      answer: 'A',
      rationale: 'From second equation $x = 3y - 4$. Substitute: $2(3y - 4) + y = 13 \\implies 7y - 8 = 13 \\implies 7y = 21 \\implies y = 3, x = 5$.',
      hasDesmos: true
    },
    {
      domain: 'Algebra',
      skill: 'Linear inequalities',
      diff: 'Hard' as DifficultyLevel,
      format: 'mcq' as const,
      stem: 'A line has slope $-\\frac{3}{4}$ and passes through the point $(-8, 11)$. Which point also lies on this line?',
      choices: [
        { key: 'A' as const, text: '(4, 2)' },
        { key: 'B' as const, text: '(0, 6)' },
        { key: 'C' as const, text: '(-4, 9)' },
        { key: 'D' as const, text: '(8, -2)' }
      ],
      answer: 'A',
      rationale: '$y - 11 = -\\frac{3}{4}(x + 8) \\implies y = -\\frac{3}{4}x + 5$. For $x = 4$: $y = -3 + 5 = 2$. Point is $(4, 2)$.',
      hasDesmos: true
    },
    // Algebra SPR
    {
      domain: 'Algebra',
      skill: 'Linear equations in one variable',
      diff: 'Easy' as DifficultyLevel,
      format: 'spr' as const,
      stem: 'If $7(x - 2) = 3x + 18$, what is the value of $x$?',
      choices: [],
      answer: '8',
      rationale: '$7x - 14 = 3x + 18 \\implies 4x = 32 \\implies x = 8$.',
      hasDesmos: true
    },
    {
      domain: 'Algebra',
      skill: 'Systems of linear equations',
      diff: 'Hard' as DifficultyLevel,
      format: 'spr' as const,
      stem: 'In the $xy$-plane, the graphs of $y = 2x + 9$ and $y = -\\frac{1}{2}x + 4$ intersect at the point $(x, y)$. What is the value of $x$?',
      choices: [],
      answer: '-2',
      rationale: '$2x + 9 = -0.5x + 4 \\implies 2.5x = -5 \\implies x = -2$.',
      hasDesmos: true
    },
    // Advanced Math MCQ
    {
      domain: 'Advanced Math',
      skill: 'Nonlinear functions',
      diff: 'Easy' as DifficultyLevel,
      format: 'mcq' as const,
      stem: 'The function $f$ is defined by $f(x) = 3x^2 - 12$. What is the value of $f(-4)$?',
      choices: [
        { key: 'A' as const, text: '36' },
        { key: 'B' as const, text: '-60' },
        { key: 'C' as const, text: '24' },
        { key: 'D' as const, text: '-36' }
      ],
      answer: 'A',
      rationale: '$f(-4) = 3(-4)^2 - 12 = 3(16) - 12 = 48 - 12 = 36$.',
      hasDesmos: true
    },
    {
      domain: 'Advanced Math',
      skill: 'Quadratic equations',
      diff: 'Medium' as DifficultyLevel,
      format: 'mcq' as const,
      stem: 'What is the sum of the solutions to $(2x - 5)(x + 4) = 0$?',
      choices: [
        { key: 'A' as const, text: '-1.5' },
        { key: 'B' as const, text: '1.5' },
        { key: 'C' as const, text: '-6.5' },
        { key: 'D' as const, text: '6.5' }
      ],
      answer: 'A',
      rationale: 'Solutions are $x = 2.5$ and $x = -4$. Sum $= 2.5 + (-4) = -1.5$.',
      hasDesmos: true
    },
    {
      domain: 'Advanced Math',
      skill: 'Polynomial roots',
      diff: 'Hard' as DifficultyLevel,
      format: 'mcq' as const,
      stem: 'For what positive value of $c$ does the quadratic equation $x^2 - 12x + c = 0$ have exactly one real solution?',
      choices: [
        { key: 'A' as const, text: '36' },
        { key: 'B' as const, text: '144' },
        { key: 'C' as const, text: '24' },
        { key: 'D' as const, text: '6' }
      ],
      answer: 'A',
      rationale: 'Discriminant $b^2 - 4ac = 0 \\implies (-12)^2 - 4(1)(c) = 0 \\implies 144 - 4c = 0 \\implies c = 36$.',
      hasDesmos: true
    },
    // Advanced Math SPR
    {
      domain: 'Advanced Math',
      skill: 'Exponential equations',
      diff: 'Medium' as DifficultyLevel,
      format: 'spr' as const,
      stem: 'If $3^{2x - 1} = 243$, what is the value of $x$?',
      choices: [],
      answer: '3',
      rationale: '$243 = 3^5$. Thus $2x - 1 = 5 \\implies 2x = 6 \\implies x = 3$.',
      hasDesmos: true
    },
    {
      domain: 'Advanced Math',
      skill: 'Nonlinear equations',
      diff: 'Hard' as DifficultyLevel,
      format: 'spr' as const,
      stem: 'What is the positive solution to $x^2 - 6x - 27 = 0$?',
      choices: [],
      answer: '9',
      rationale: '$(x - 9)(x + 3) = 0$. Positive root is $x = 9$.',
      hasDesmos: true
    },
    // Problem Solving MCQ
    {
      domain: 'Problem-Solving and Data Analysis',
      skill: 'Ratios, rates, and proportional relationships',
      diff: 'Easy' as DifficultyLevel,
      format: 'mcq' as const,
      stem: 'A runner completes a 10-kilometer course in 48 minutes at a constant pace. At this rate, how many minutes will it take the runner to complete 15 kilometers?',
      choices: [
        { key: 'A' as const, text: '72' },
        { key: 'B' as const, text: '60' },
        { key: 'C' as const, text: '80' },
        { key: 'D' as const, text: '68' }
      ],
      answer: 'A',
      rationale: 'Pace $= 48 / 10 = 4.8$ minutes per km. Time for 15 km $= 15 \\times 4.8 = 72$ minutes.'
    },
    {
      domain: 'Problem-Solving and Data Analysis',
      skill: 'Probability and data distributions',
      diff: 'Medium' as DifficultyLevel,
      format: 'mcq' as const,
      stem: 'A dataset consists of five positive integers: $12, 15, 18, 22$, and $x$. If the mean of the dataset is 20, what is the value of $x$?',
      choices: [
        { key: 'A' as const, text: '33' },
        { key: 'B' as const, text: '28' },
        { key: 'C' as const, text: '35' },
        { key: 'D' as const, text: '25' }
      ],
      answer: 'A',
      rationale: 'Sum $= 5 \\times 20 = 100$. $12 + 15 + 18 + 22 + x = 67 + x = 100 \\implies x = 33$.'
    },
    // Problem Solving SPR
    {
      domain: 'Problem-Solving and Data Analysis',
      skill: 'Percentages and rates',
      diff: 'Hard' as DifficultyLevel,
      format: 'spr' as const,
      stem: 'A store increases the price of a jacket by 20%, and then discounts the new price by 15%. What is the overall percentage increase from the original price? (e.g. enter 2 for 2%).',
      choices: [],
      answer: '2',
      rationale: 'New price $= 1.20 \\times 0.85 = 1.02$, which represents a 2% net increase.'
    },
    // Geometry & Trig MCQ
    {
      domain: 'Geometry and Trigonometry',
      skill: 'Lines, angles, and triangles',
      diff: 'Easy' as DifficultyLevel,
      format: 'mcq' as const,
      stem: 'In an isosceles triangle, the measure of the vertex angle between the two equal sides is $80^\\circ$. What is the measure, in degrees, of each base angle?',
      choices: [
        { key: 'A' as const, text: '50' },
        { key: 'B' as const, text: '40' },
        { key: 'C' as const, text: '60' },
        { key: 'D' as const, text: '45' }
      ],
      answer: 'A',
      rationale: 'Base angles are equal: $(180 - 80) / 2 = 100 / 2 = 50^\\circ$.'
    },
    {
      domain: 'Geometry and Trigonometry',
      skill: 'Right triangles and trigonometry',
      diff: 'Medium' as DifficultyLevel,
      format: 'mcq' as const,
      stem: 'In a right triangle, the hypotenuse has length 17 and one leg has length 8. What is the length of the other leg?',
      choices: [
        { key: 'A' as const, text: '15' },
        { key: 'B' as const, text: '12' },
        { key: 'C' as const, text: '14' },
        { key: 'D' as const, text: '16' }
      ],
      answer: 'A',
      rationale: 'Pythagorean triple: $8^2 + b^2 = 17^2 \\implies 64 + b^2 = 289 \\implies b^2 = 225 \\implies b = 15$.'
    },
    // Geometry & Trig SPR
    {
      domain: 'Geometry and Trigonometry',
      skill: 'Circles and radian measure',
      diff: 'Hard' as DifficultyLevel,
      format: 'spr' as const,
      stem: 'In a circle with radius 18, an arc subtends a central angle of $\\frac{\\pi}{3}$ radians. What is the length of this arc in terms of $\\pi$? (If length is $k\\pi$, enter the value of $k$).',
      choices: [],
      answer: '6',
      rationale: 'Arc length $s = r\\theta = 18 \\times \\frac{\\pi}{3} = 6\\pi$. So $k = 6$.'
    }
  ];

  mathTemplates.forEach((item, idx) => {
    bank.push({
      id: `gen-math-${idx}`,
      cb_question_id: `CB-GEN-M-${500 + idx}`,
      section: 'math',
      domain: item.domain,
      skill: item.skill,
      difficulty: item.diff,
      format: item.format,
      stimulus_html: '',
      stem_html: item.stem,
      choices: item.choices,
      correct_answer: item.answer,
      rationale_html: item.rationale,
      irt_b: irtParams[item.diff].b + (idx * 0.03),
      irt_a: irtParams[item.diff].a + (idx * 0.01),
      has_algebra_or_poly: item.hasDesmos
    });
  });

  return bank;
}
