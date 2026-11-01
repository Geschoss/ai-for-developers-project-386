/** A stored Бронирование. The Гость's name and email stay plain strings. */
interface StoredBooking {
  guestEmail: string;
  guestName: string;
  id: string;
  startAt: Date;
}

class Booking {
  public readonly guestEmail: string;
  public readonly guestName: string;
  public readonly id: string;
  public readonly startAt: Date;

  public constructor(booking: StoredBooking) {
    this.guestEmail = booking.guestEmail;
    this.guestName = booking.guestName;
    this.id = booking.id;
    this.startAt = booking.startAt;
  }
}

export { Booking, type StoredBooking };
