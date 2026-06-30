import { DeleteSiteDialog } from '../delete-site-dialog';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export default function DeleteSiteDialogExample() {
  const [open, setOpen] = useState(false);

  return (
    <div className="p-8">
      <Button onClick={() => setOpen(true)}>Open Delete Dialog</Button>
      <DeleteSiteDialog
        open={open}
        onOpenChange={setOpen}
        siteDomain="example.com"
        onConfirm={() => {
          console.log('Site deleted!');
          setOpen(false);
        }}
      />
    </div>
  );
}
