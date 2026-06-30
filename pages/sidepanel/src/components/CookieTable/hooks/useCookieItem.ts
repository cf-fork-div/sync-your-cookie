import {
  catchHandler,
  editCookieItemUsingMessage,
  ICookie,
  removeCookieItemUsingMessage,
  useI18n,
} from '@sync-your-cookie/shared';
import { useState } from 'react';
import { toast } from 'sonner';

export const useCookieItem = (selectedDomain: string) => {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);

  const handleDeleteItem = async (id: string) => {
    try {
      setLoading(true);
      await removeCookieItemUsingMessage({
        domain: selectedDomain,
        id,
      })
        .then(async res => {
          if (res.isOk) {
            toast.success(res.msg || t('success'));
          } else {
            toast.error(res.msg || t('deletedFail'));
          }
        })
        .catch(err => {
          catchHandler(err, 'delete', toast, t);
        });
    } finally {
      setLoading(false);
    }
  };

  const handleEditItem = async (oldItem: ICookie, newItem: ICookie) => {
    try {
      setLoading(true);
      await editCookieItemUsingMessage({
        domain: selectedDomain,
        oldItem,
        newItem,
      })
        .then(async res => {
          if (res.isOk) {
            toast.success(res.msg || t('success'));
          } else {
            toast.error(res.msg || t('editedFail'));
            return Promise.reject(res);
          }
        })
        .catch(err => {
          catchHandler(err, 'edit', toast, t);
          return Promise.reject(err);
        });
    } finally {
      setLoading(false);
    }
  };
  return {
    loading,
    handleDeleteItem,
    handleEditItem,
  };
};
