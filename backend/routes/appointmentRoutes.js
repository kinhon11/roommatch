const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { createAppointment, updateAppointmentStatus, rescheduleAppointment, getAppointments } = require('../controllers/appointmentController');

// Tenant creates an appointment; broker can create one on behalf of a lead/tenant.
router.post('/', protect, restrictTo('tenant', 'broker'), createAppointment);

// Landlord OR tenant can update appointment status (controller handles role-based permission)
router.patch('/:id', protect, restrictTo('tenant', 'landlord', 'broker'), updateAppointmentStatus);
router.patch('/:id/reschedule', protect, restrictTo('tenant', 'landlord', 'broker'), rescheduleAppointment);

// Get appointments (tenant or landlord based on role)
router.get('/', protect, getAppointments);

module.exports = router;
