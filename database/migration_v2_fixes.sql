-- ============================================================
-- Migration: Fixes & Additions (v2)
-- Chạy file này SAU migration_expand_roommie.sql
-- ============================================================

-- 1. Cho phép tenant update (delete) roommate_requests của chính họ
-- (cần thêm policy DELETE cho tenant)
DROP POLICY IF EXISTS "Tenants can delete own pending requests" ON public.roommate_requests;
CREATE POLICY "Tenants can delete own pending requests" ON public.roommate_requests
  FOR DELETE USING (auth.uid() = tenant_id AND status = 'pending');

-- 2. Cho phép user tự UPDATE notifications của mình (để mark-all-read)
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- 3. Cho phép tenant cancel (update status) appointment của mình
-- Bổ sung policy UPDATE cho tenant trên appointments
DROP POLICY IF EXISTS "Tenants can cancel own appointments" ON public.appointments;
CREATE POLICY "Tenants can cancel own appointments" ON public.appointments
  FOR UPDATE USING (auth.uid() = tenant_id)
  WITH CHECK (status = 'cancelled');

-- 4. Đảm bảo Supabase Realtime được enable cho bảng notifications
-- (Thực hiện thủ công trong Supabase Dashboard: Database → Replication → notifications)
-- Lệnh dưới chỉ để tham khảo, không thể chạy qua SQL Editor:
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 5. Thêm index cho notifications.read để query unread nhanh hơn
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, read) WHERE read = FALSE;

-- 6. Cập nhật available_slots trigger để KHÔNG xử lý trường hợp INSERT (chỉ UPDATE)
-- vì request luôn bắt đầu từ 'pending', chỉ khi landlord accept thì mới giảm slot
CREATE OR REPLACE FUNCTION adjust_room_available_slots() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Khi chuyển sang accepted: giảm slot
    IF OLD.status <> 'accepted' AND NEW.status = 'accepted' THEN
      UPDATE public.rooms
        SET available_slots = GREATEST(available_slots - 1, 0)
        WHERE id = NEW.room_id;
    -- Khi hủy accepted (rejected hoặc bị xóa thông qua trigger nếu cần): hoàn lại slot
    ELSIF OLD.status = 'accepted' AND NEW.status <> 'accepted' THEN
      UPDATE public.rooms
        SET available_slots = available_slots + 1
        WHERE id = NEW.room_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger for UPDATE only
DROP TRIGGER IF EXISTS trigger_adjust_slots ON public.roommate_requests;
CREATE TRIGGER trigger_adjust_slots
  AFTER UPDATE ON public.roommate_requests
  FOR EACH ROW EXECUTE FUNCTION adjust_room_available_slots();

-- 7. Trigger hoàn lại slot khi request bị DELETE (tenant cancel pending)
CREATE OR REPLACE FUNCTION restore_slot_on_request_delete() RETURNS TRIGGER AS $$
BEGIN
  -- Nếu request đang ở accepted và bị xóa (hiếm, nhưng an toàn)
  IF OLD.status = 'accepted' THEN
    UPDATE public.rooms SET available_slots = available_slots + 1 WHERE id = OLD.room_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_restore_slot_on_delete ON public.roommate_requests;
CREATE TRIGGER trigger_restore_slot_on_delete
  AFTER DELETE ON public.roommate_requests
  FOR EACH ROW EXECUTE FUNCTION restore_slot_on_request_delete();

-- ============================================================
-- End of Migration v2
-- ============================================================
