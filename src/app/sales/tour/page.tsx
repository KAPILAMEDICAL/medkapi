import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { getEnrichedTour, startOfDay } from '@/lib/tours';
import { TourStopCard } from '@/components/sales/TourStopCard';
import { EmptyState } from '@/components/ui/EmptyState';

export default async function TourPage() {
  const session = await getCurrentUser();
  const salesman = await prisma.salesman.findUnique({ where: { userId: session!.userId } });
  if (!salesman) return null;

  const today = startOfDay();
  const tour = await getEnrichedTour(salesman.id, today);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-ink">Today&apos;s Tour</h1>
        <p className="text-sm text-ink-muted">{today.toDateString()}</p>
      </div>

      {tour.stops.length === 0 ? (
        <EmptyState title="No tour scheduled for today." description="Your manager has not assigned any customer visits yet." />
      ) : (
        <div className="space-y-3">
          {tour.stops.map((stop) => (
            <TourStopCard key={stop.id} stop={stop} />
          ))}
        </div>
      )}
    </div>
  );
}
