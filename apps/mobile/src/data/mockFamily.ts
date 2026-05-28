import { Chore, FamilyMember, MealPlanItem, PlanEvent, ShoppingItem, TextUpdate } from "../types";
import { colors } from "../constants/theme";

export const members: FamilyMember[] = [
  {
    id: "mara",
    name: "Mara",
    initials: "MA",
    color: colors.primary,
    role: "parent",
    starBalance: 0
  },
  {
    id: "jules",
    name: "Jules",
    initials: "JU",
    color: colors.coral,
    role: "kid",
    starBalance: 18
  },
  {
    id: "noah",
    name: "Noah",
    initials: "NO",
    color: colors.mint,
    role: "kid",
    starBalance: 11
  },
  {
    id: "nana",
    name: "Nana",
    initials: "NA",
    color: colors.berry,
    role: "caregiver",
    starBalance: 0
  }
];

export const planEvents: PlanEvent[] = [
  {
    id: "pickup",
    title: "School pickup",
    time: "3:10 PM",
    dateLabel: "Today",
    location: "Westbrook Elementary",
    assignedTo: ["mara", "jules", "noah"],
    source: "manual"
  },
  {
    id: "soccer",
    title: "Noah soccer practice",
    time: "5:00 PM",
    dateLabel: "Today",
    location: "Field 4",
    assignedTo: ["noah", "nana"],
    source: "text"
  },
  {
    id: "rx",
    title: "Pick up allergy refill",
    time: "6:15 PM",
    dateLabel: "Today",
    location: "CVS",
    assignedTo: ["mara"],
    source: "assistant"
  }
];

export const chores: Chore[] = [
  {
    id: "dishwasher",
    title: "Unload dishwasher",
    dueLabel: "Before dinner",
    assignedTo: "jules",
    stars: 2,
    completed: false
  },
  {
    id: "backpacks",
    title: "Pack tomorrow backpacks",
    dueLabel: "8:00 PM",
    assignedTo: "noah",
    stars: 3,
    completed: false
  },
  {
    id: "plants",
    title: "Water kitchen herbs",
    dueLabel: "Anytime today",
    assignedTo: "jules",
    stars: 1,
    completed: true
  }
];

export const shoppingItems: ShoppingItem[] = [
  {
    id: "milk",
    title: "Oat milk",
    category: "Dairy",
    addedBy: "mara",
    checked: false
  },
  {
    id: "bananas",
    title: "Bananas",
    category: "Produce",
    addedBy: "noah",
    checked: false
  },
  {
    id: "detergent",
    title: "Laundry detergent",
    category: "Household",
    addedBy: "nana",
    checked: true
  }
];

export const mealPlanItems: MealPlanItem[] = [
  {
    id: "meal-mon-dinner",
    dayOfWeek: 0,
    mealType: "dinner",
    title: "Sheet-pan chicken fajitas",
    notes: "Double peppers for leftovers"
  },
  {
    id: "meal-tue-dinner",
    dayOfWeek: 1,
    mealType: "dinner",
    title: "Pasta night",
    notes: "Use the spinach in the fridge"
  },
  {
    id: "meal-wed-dinner",
    dayOfWeek: 2,
    mealType: "dinner",
    title: "Breakfast-for-dinner",
    notes: "Pancakes and fruit"
  }
];

export const textUpdates: TextUpdate[] = [
  {
    id: "text-1",
    direction: "inbound",
    author: "Nana",
    body: "I can take Noah to soccer at 5 if pickup runs late.",
    createdAt: "2:16 PM",
    convertedTo: "event"
  },
  {
    id: "text-2",
    direction: "outbound",
    author: "HomeThread",
    body: "Today: pickup 3:10, soccer 5:00, allergy refill 6:15. Chores left: dishwasher, backpacks.",
    createdAt: "8:05 AM"
  }
];
