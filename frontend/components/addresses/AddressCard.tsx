import React from 'react';
import { MapPin, Phone, Star, MoreVertical } from 'lucide-react';
import Link from 'next/link';

interface Address {
  id: string;
  label: string;
  contact_name: string;
  contact_phone: string;
  address_line1: string;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
}

interface AddressCardProps {
  address: Address;
  onSetDefault: (id: string) => void;
  onDelete: (id: string) => void;
}

export const AddressCard: React.FC<AddressCardProps> = ({ address, onSetDefault, onDelete }) => {
  return (
    <div className="bg-white dark:bg-[#131620] rounded-xl shadow-sm border border-slate-200 dark:border-white/[0.06] p-5 relative group">
      {address.is_default && (
        <div className="absolute -top-3 -right-3 bg-purple-50 dark:bg-purple-950/40 text-[#8410DC] dark:text-purple-300 px-3 py-1 rounded-full text-xs font-semibold flex items-center shadow-sm border border-purple-100 dark:border-indigo-900/30">
          <Star className="w-3 h-3 mr-1 fill-current" /> Default
        </div>
      )}
      
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white text-lg flex items-center">
            {address.label}
          </h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 flex items-center">
            <span className="font-medium mr-2">{address.contact_name}</span> • 
            <Phone className="w-3 h-3 mx-2" /> {address.contact_phone}
          </p>
        </div>
        
        <div className="relative group/menu">
          <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-white/[0.04] transition">
            <MoreVertical className="w-5 h-5" />
          </button>
          <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-[#1e2230] border border-slate-100 dark:border-white/[0.08] rounded-lg shadow-lg opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-10">
            <div className="py-1">
              <Link href={`/settings/addresses/${address.id}`} className="block px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.02]">Edit</Link>
              {!address.is_default && (
                <button onClick={() => onSetDefault(address.id)} className="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.02]">Set Default</button>
              )}
              <button onClick={() => onDelete(address.id)} className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20">Delete</button>
            </div>
          </div>
        </div>
      </div>

      <div className="text-sm text-slate-600 dark:text-slate-300 flex items-start bg-slate-50 dark:bg-[#0f1117] p-3 rounded-lg border border-slate-100 dark:border-white/[0.04]">
        <MapPin className="w-4 h-4 mr-2 mt-0.5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
        <p>
          {address.address_line1}, {address.city}, {address.state} - {address.pincode}
        </p>
      </div>
    </div>
  );
};
