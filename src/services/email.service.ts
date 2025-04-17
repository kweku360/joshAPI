import nodemailer from "nodemailer";
import config from "../config";
import { logger } from "../utils/logger";

// Create nodemailer transporter
const transporter = nodemailer.createTransport({
  host: config.email.host,
  port: config.email.port,
  secure: config.email.port === 465, // true for 465, false for other ports
  auth: {
    user: config.email.username,
    pass: config.email.password,
  },
  tls: {
    // Disable all certificate validation in development
    rejectUnauthorized: false,
  },
});

// Verify connection
transporter.verify((error) => {
  if (error) {
    logger.error("Email service not ready", error);
  } else {
    logger.info("Email service ready");
  }
});

export const emailService = {
  /**
   * Send an email
   * @param to Recipient email
   * @param subject Email subject
   * @param html Email HTML content
   * @param text Email text content
   */
  async sendEmail(
    to: string,
    subject: string,
    html: string,
    text?: string
  ): Promise<void> {
    try {
      await transporter.sendMail({
        from: `"Josh Travels" <${config.email.from}>`,
        to,
        subject,
        text: text || "",
        html,
      });
      logger.info(`Email sent to ${to}`);
    } catch (error) {
      logger.error("Error sending email", error);
      throw error;
    }
  },

  /**
   * Send booking confirmation email
   * @param to Recipient email
   * @param bookingReference Booking reference
   * @param flightOfferData Flight offer data
   * @param passengerDetails Passenger details
   * @param totalAmount Total amount
   * @param currency Currency
   */
  async sendBookingConfirmationEmail(
    to: string,
    bookingReference: string,
    flightOfferData: any,
    passengerDetails: any[],
    totalAmount: number,
    currency: string
  ): Promise<void> {
    try {
      // Format flight details for email
      let flightInfo = "";
      if (
        flightOfferData.itineraries &&
        Array.isArray(flightOfferData.itineraries)
      ) {
        flightInfo = flightOfferData.itineraries
          .map((itinerary: any, idx: number) => {
            const journey = idx === 0 ? "Outbound" : "Return";
            const segments = itinerary.segments
              .map((segment: any) => {
                return `
              <div style="margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
                <p><strong>${segment.departure.iataCode} → ${segment.arrival.iataCode}</strong></p>
                <p>Departure: ${new Date(segment.departure.at).toLocaleString()}</p>
                <p>Arrival: ${new Date(segment.arrival.at).toLocaleString()}</p>
                <p>Flight: ${segment.carrierCode} ${segment.number}</p>
              </div>
            `;
              })
              .join("");

            return `
            <div style="margin-bottom: 20px; border: 1px solid #ddd; padding: 15px; border-radius: 5px;">
              <h3>${journey} Journey</h3>
              ${segments}
            </div>
          `;
          })
          .join("");
      }

      // Format passenger details
      const passengersInfo = passengerDetails
        .map((passenger: any, idx: number) => {
          return `
          <div style="margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
            <p><strong>Passenger ${idx + 1}</strong></p>
            <p>Name: ${passenger.firstName} ${passenger.lastName}</p>
            <p>Date of Birth: ${passenger.dateOfBirth}</p>
          </div>
        `;
        })
        .join("");

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Booking Confirmation</h2>
          <p>Thank you for booking with Josh Travels!</p>
          <p>Your booking has been confirmed with reference: <strong>${bookingReference}</strong></p>
          
          <div style="margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-radius: 5px;">
            <h3>Booking Details</h3>
            <p>Total Amount: ${totalAmount} ${currency}</p>
            
            <h3>Flight Information</h3>
            ${flightInfo}
            
            <h3>Passenger Information</h3>
            ${passengersInfo}
          </div>
          
          <p>You can view your booking details and e-ticket in your account dashboard.</p>
          <p>Safe travels!</p>
          <p>Best regards,<br>The Josh Travels Team</p>
        </div>
      `;

      const text = `
        Booking Confirmation
        
        Thank you for booking with Josh Travels!
        
        Your booking has been confirmed with reference: ${bookingReference}
        
        Booking Details:
        Total Amount: ${totalAmount} ${currency}
        
        Please log in to your account to view complete booking details and e-ticket.
        
        Safe travels!
        
        Thanks,
        Josh Travels Team
      `;

      await this.sendEmail(
        to,
        `Booking Confirmation - ${bookingReference}`,
        html,
        text
      );
    } catch (error) {
      logger.error("Error sending booking confirmation email", error);
      throw new Error("Failed to send booking confirmation email");
    }
  },

  /**
   * Send booking cancellation email
   * @param to Recipient email
   * @param bookingReference Booking reference
   */
  async sendBookingCancellationEmail(
    to: string,
    bookingReference: string
  ): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Booking Cancellation</h2>
        <p>Your booking with reference <strong>${bookingReference}</strong> has been cancelled.</p>
        <p>If you did not request this cancellation, please contact our customer support immediately.</p>
        <p>Best regards,<br>The Josh Travels Team</p>
      </div>
    `;

    const text = `
      Booking Cancellation
      
      Your booking with reference ${bookingReference} has been cancelled.
      
      If you did not request this cancellation, please contact our customer support immediately.
      
      Thanks,
      Josh Travels Team
    `;

    await this.sendEmail(to, "Booking Cancellation - Josh Travels", html, text);
  },

  /**
   * Send OTP verification email
   * @param to Recipient email
   * @param otp One-time password
   * @param name Recipient name
   */
  async sendOTPEmail(to: string, otp: string, name: string): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Your Verification Code</h2>
        <p>Hello ${name || "there"},</p>
        <p>Your verification code for Josh Travels is:</p>
        <div style="margin: 30px 0; padding: 20px; background-color: #f7f7f7; border-radius: 5px; text-align: center; font-size: 24px; letter-spacing: 5px; font-weight: bold;">
          ${otp}
        </div>
        <p>This code will expire in 15 minutes.</p>
        <p>If you didn't request this code, please ignore this email.</p>
        <p>Best regards,<br>The Josh Travels Team</p>
      </div>
    `;

    const text = `
      Your Verification Code
      
      Hello ${name || "there"},
      
      Your verification code for Josh Travels is: ${otp}
      
      This code will expire in 15 minutes.
      
      If you didn't request this code, please ignore this email.
      
      Best regards,
      The Josh Travels Team
    `;

    await this.sendEmail(to, "Verification Code - Josh Travels", html, text);
  },

  /**
   * Send OTP verification email for guest account creation
   * @param to Recipient email
   * @param otp One-time password
   */
  async sendGuestOTPEmail(to: string, otp: string): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Your Guest Account Verification Code</h2>
        <p>Hello,</p>
        <p>Your verification code for creating a guest account at Josh Travels is:</p>
        <div style="margin: 30px 0; padding: 20px; background-color: #f7f7f7; border-radius: 5px; text-align: center; font-size: 24px; letter-spacing: 5px; font-weight: bold;">
          ${otp}
        </div>
        <p>This code will expire in 15 minutes.</p>
        <p>With a guest account, you can make bookings and complete your registration later.</p>
        <p>If you didn't request this code, please ignore this email.</p>
        <p>Best regards,<br>The Josh Travels Team</p>
      </div>
    `;

    const text = `
      Your Guest Account Verification Code
      
      Hello,
      
      Your verification code for creating a guest account at Josh Travels is: ${otp}
      
      This code will expire in 15 minutes.
      
      With a guest account, you can make bookings and complete your registration later.
      
      If you didn't request this code, please ignore this email.
      
      Best regards,
      The Josh Travels Team
    `;

    await this.sendEmail(
      to,
      "Guest Account Verification - Josh Travels",
      html,
      text
    );
  },

  /**
   * Send OTP verification email for registration
   * @param to Recipient email
   * @param otp One-time password
   */
  async sendRegistrationOTPEmail(to: string, otp: string): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Your Registration Verification Code</h2>
        <p>Hello,</p>
        <p>Thank you for registering with Josh Travels. Your verification code is:</p>
        <div style="margin: 30px 0; padding: 20px; background-color: #f7f7f7; border-radius: 5px; text-align: center; font-size: 24px; letter-spacing: 5px; font-weight: bold;">
          ${otp}
        </div>
        <p>This code will expire in 15 minutes.</p>
        <p>Once verified, you'll have full access to our travel booking services.</p>
        <p>If you didn't register for an account, please ignore this email.</p>
        <p>Best regards,<br>The Josh Travels Team</p>
      </div>
    `;

    const text = `
      Your Registration Verification Code
      
      Hello,
      
      Thank you for registering with Josh Travels. Your verification code is: ${otp}
      
      This code will expire in 15 minutes.
      
      Once verified, you'll have full access to our travel booking services.
      
      If you didn't register for an account, please ignore this email.
      
      Best regards,
      The Josh Travels Team
    `;

    await this.sendEmail(
      to,
      "Registration Verification - Josh Travels",
      html,
      text
    );
  },

  /**
   * Send welcome email to guest users
   * @param to Recipient email
   * @param name Recipient first name
   */
  async sendGuestWelcomeEmail(to: string, name: string): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to Josh Travels!</h2>
        <p>Hello ${name || "there"},</p>
        <p>Thank you for booking with Josh Travels. Your account has been created as a guest user.</p>
        <p>You can now:</p>
        <ul>
          <li>Track your bookings</li>
          <li>Manage your travel details</li>
          <li>Receive updates on your flights</li>
        </ul>
        <p>If you'd like to upgrade to a full account for additional benefits and to save your preferences, you can do so from your account dashboard.</p>
        <p>Best regards,<br>The Josh Travels Team</p>
      </div>
    `;

    const text = `
      Welcome to Josh Travels!
      
      Hello ${name},
      
      Thank you for booking with Josh Travels. Your account has been created as a guest user.
      
      You can now:
      - Track your bookings
      - Manage your travel details
      - Receive updates on your flights
      
      If you'd like to upgrade to a full account for additional benefits and to save your preferences, you can do so from your account dashboard.
      
      Best regards,
      The Josh Travels Team
    `;

    await this.sendEmail(to, "Welcome to Josh Travels", html, text);
  },

  /**
   * Send flight booking confirmation email
   * @param email Recipient email
   * @param name Recipient name
   * @param bookingReference Booking reference
   * @param flightOffer Flight offer
   */
  async sendFlightBookingConfirmation(
    email: string,
    name: string,
    bookingReference: string,
    flightOffer: any
  ): Promise<void> {
    const flights = flightOffer.itineraries.flatMap((itinerary: any) =>
      itinerary.segments.map((segment: any) => ({
        departure: {
          iataCode: segment.departure.iataCode,
          terminal: segment.departure.terminal,
          at: new Date(segment.departure.at).toLocaleString(),
        },
        arrival: {
          iataCode: segment.arrival.iataCode,
          terminal: segment.arrival.terminal,
          at: new Date(segment.arrival.at).toLocaleString(),
        },
        carrierCode: segment.carrierCode,
        number: segment.number,
        duration: segment.duration,
      }))
    );

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Flight Booking Confirmation</h2>
        <p>Hello ${name},</p>
        <p>Your flight booking has been confirmed. Your booking reference is <strong>${bookingReference}</strong>.</p>
        
        <div style="margin: 20px 0; padding: 15px; background-color: #f7f7f7; border-radius: 5px;">
          <h3>Flight Details</h3>
          ${flights
            .map(
              (flight: any, index: number) => `
              <div style="margin-bottom: 15px; ${
                index > 0
                  ? "border-top: 1px solid #ddd; padding-top: 15px;"
                  : ""
              }">
                <p><strong>Flight:</strong> ${flight.carrierCode} ${flight.number}</p>
                <p><strong>Departure:</strong> ${flight.departure.iataCode} Terminal ${
                  flight.departure.terminal || "N/A"
                } - ${flight.departure.at}</p>
                <p><strong>Arrival:</strong> ${flight.arrival.iataCode} Terminal ${
                  flight.arrival.terminal || "N/A"
                } - ${flight.arrival.at}</p>
                <p><strong>Duration:</strong> ${flight.duration}</p>
              </div>
            `
            )
            .join("")}
        </div>
        
        <div style="margin: 20px 0; padding: 15px; background-color: #f7f7f7; border-radius: 5px;">
          <h3>Price Details</h3>
          <p><strong>Total Price:</strong> ${flightOffer.price.total} ${
            flightOffer.price.currency
          }</p>
        </div>
        
        <p>Thank you for choosing JoshTravels. We wish you a pleasant journey!</p>
        <p>Best regards,<br>The JoshTravels Team</p>
      </div>
    `;

    const text = `
      Flight Booking Confirmation
      
      Hello ${name},
      
      Your flight booking has been confirmed. Your booking reference is ${bookingReference}.
      
      Flight Details:
      ${flights
        .map(
          (flight: any) => `
        Flight: ${flight.carrierCode} ${flight.number}
        Departure: ${flight.departure.iataCode} Terminal ${
          flight.departure.terminal || "N/A"
        } - ${flight.departure.at}
        Arrival: ${flight.arrival.iataCode} Terminal ${
          flight.arrival.terminal || "N/A"
        } - ${flight.arrival.at}
        Duration: ${flight.duration}
      `
        )
        .join("\n")}
      
      Price Details:
      Total Price: ${flightOffer.price.total} ${flightOffer.price.currency}
      
      Thank you for choosing JoshTravels. We wish you a pleasant journey!
      
      Best regards,
      The JoshTravels Team
    `;

    await this.sendEmail(
      email,
      "Flight Booking Confirmation - JoshTravels",
      html,
      text
    );
  },

  /**
   * Send payment confirmation email
   * @param to Recipient email address
   * @param bookingReference Booking reference
   * @param amount Payment amount
   * @param currency Currency code
   * @returns Promise resolving when email is sent
   */
  async sendPaymentConfirmationEmail(
    to: string,
    bookingReference: string,
    amount: number,
    currency: string
  ): Promise<void> {
    const subject = `Payment Confirmation for Booking ${bookingReference}`;
    
    // Format the amount with 2 decimal places
    const formattedAmount = (Math.round(amount * 100) / 100).toFixed(2);
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Payment Confirmation</h2>
        <p>Thank you for your payment. Your booking is now confirmed.</p>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Booking Reference:</strong> ${bookingReference}</p>
          <p><strong>Amount Paid:</strong> ${formattedAmount} ${currency}</p>
        </div>
        
        <p>You can view your booking details and e-ticket by logging into your account.</p>
        
        <p>If you have any questions, please contact our customer service.</p>
        
        <p>Thank you for choosing Josh Travels!</p>
      </div>
    `;
    
    await this.sendEmail(to, subject, html);
  },

  /**
   * Send refund confirmation email
   * @param to Recipient email address
   * @param bookingReference Booking reference
   * @param amount Refund amount
   * @param currency Currency code
   * @returns Promise resolving when email is sent
   */
  async sendRefundConfirmationEmail(
    to: string,
    bookingReference: string,
    amount: number,
    currency: string
  ): Promise<void> {
    const subject = `Refund Confirmation for Booking ${bookingReference}`;
    
    // Format the amount with 2 decimal places
    const formattedAmount = (Math.round(amount * 100) / 100).toFixed(2);
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Refund Confirmation</h2>
        <p>We have processed a refund for your booking.</p>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Booking Reference:</strong> ${bookingReference}</p>
          <p><strong>Refund Amount:</strong> ${formattedAmount} ${currency}</p>
        </div>
        
        <p>The refund may take 5-10 business days to appear in your account, depending on your payment provider.</p>
        
        <p>If you have any questions, please contact our customer service.</p>
        
        <p>Thank you for choosing Josh Travels!</p>
      </div>
    `;
    
    await this.sendEmail(to, subject, html);
  },
};
