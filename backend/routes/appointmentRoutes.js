const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { createAppointment, updateAppointmentStatus, rescheduleAppointment, getAppointments } = require('../controllers/appointmentController');

// Tenant creates an appointment
router.post('/', protect, restrictTo('tenant'), createAppointment);

// Landlord OR tenant can update appointment status (controller handles role-based permission)
router.patch('/:id', protect, restrictTo('tenant', 'landlord'), updateAppointmentStatus);
router.patch('/:id/reschedule', protect, restrictTo('tenant', 'landlord'), rescheduleAppointment);

// Get appointments (tenant or landlord based on role)
router.get('/', protect, getAppointments);

module.exports = router;
